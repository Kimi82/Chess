import React from "react"
import GameMenu from "./components/gameMenu"
import Board from "./components/board"
import GameInformation from "./components/gameInformation"
import DefaultSettings from "./core/settings"
import DefaultAppState from "./core/appstate"
import getPieceMoves, { isPositionAttacked } from "./core/pieceMoves"
import { getPositionName, getOppositeColor, getLastObject } from "./core/functions"
import { Dictionary, Vector, Settings, AppState, Piece, HistoryMove, PlayerColor, PieceTypes, PieceMove, MoveTypes } from "./core/types"

let HISTORY_MOVE_ID = 0

const App: React.FunctionComponent<{}> = () => {
  const [settings, setSettings] = React.useState<Settings>(DefaultSettings)
  const [state, setState]  = React.useState<AppState>(DefaultAppState)
  const isBackwardDisabled = state.lastMove == undefined
  const isForwardDisabled  = !Object.keys(state.historyMoves).length || state.lastMove != undefined && state.lastMove.id === getLastObject(state.historyMoves).id

  React.useEffect(() => {
    if (!settings.hasStarted)
      return undefined

    const secondPlayerColor = settings.startPlayer === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE
    const firstPlayer = createPlayerPieces(settings.startPlayer, 6, false)
    const secondPlayer = createPlayerPieces(secondPlayerColor, 0, true)
    return setState({ ...DefaultAppState, pieces: { ...firstPlayer, ...secondPlayer }, playerMove: settings.startPlayer })
  }, [settings.hasStarted])

  React.useEffect(() => {
    const playerKing = state.pieces[Object.keys(state.pieces).find(key => state.pieces[key].type === PieceTypes.KING && state.pieces[key].color === state.playerMove) as string]
    const oppositeColor = getOppositeColor(state.playerMove)
    if (!Object.keys(state.pieces).length || Object.keys(getPieceMoves(playerKing, state.pieces)).length  || !isPositionAttacked(playerKing.position, oppositeColor, state.pieces))
      return undefined

    setState(prevState => ({ ...prevState, historyMoves: { ...prevState.historyMoves, [getLastObject(prevState.historyMoves).id]: { ...getLastObject(prevState.historyMoves), isEndMove: true } } }))
    return setSettings(prevState => ({ ...prevState, hasStarted: false, startPlayer: state.playerMove, score: { ...prevState.score, [oppositeColor]: prevState.score[oppositeColor] + 1 } }))
  }, [state.playerMove])

  const createPlayerPieces = (color: PlayerColor, offsetY: number, switchRows: boolean): Dictionary<Piece> => {
    const pieces: Dictionary<Piece> = {}
    const pawnY  = switchRows ? offsetY + 1 : offsetY
    const pieceY = switchRows ? offsetY     : offsetY + 1

    for (let i = 0; i < 8; ++i)
      pieces[getPositionName({ x: i, y: pawnY })] = { color, type: PieceTypes.PAWN, position: { x: i, y: pawnY }}
    pieces[getPositionName({ x: 0, y: pieceY })] = { color, type: PieceTypes.ROOK  , position: { x: 0, y: pieceY }}
    pieces[getPositionName({ x: 1, y: pieceY })] = { color, type: PieceTypes.KNIGHT, position: { x: 1, y: pieceY }}
    pieces[getPositionName({ x: 2, y: pieceY })] = { color, type: PieceTypes.BISHOP, position: { x: 2, y: pieceY }}
    pieces[getPositionName({ x: 3, y: pieceY })] = { color, type: PieceTypes.QUEEN , position: { x: 3, y: pieceY }}
    pieces[getPositionName({ x: 4, y: pieceY })] = { color, type: PieceTypes.KING  , position: { x: 4, y: pieceY }}
    pieces[getPositionName({ x: 5, y: pieceY })] = { color, type: PieceTypes.BISHOP, position: { x: 5, y: pieceY }}
    pieces[getPositionName({ x: 6, y: pieceY })] = { color, type: PieceTypes.KNIGHT, position: { x: 6, y: pieceY }}
    pieces[getPositionName({ x: 7, y: pieceY })] = { color, type: PieceTypes.ROOK  , position: { x: 7, y: pieceY }}

    return pieces
  }

  const onGameStart = (): void => setSettings(prevState => ({ ...prevState, hasStarted: true }))

  const onCellClick = (position: Vector): void => {
    if (state.promotionPiece != undefined)
      return undefined

    const hasMove = state.selectedMoves[getPositionName(position)]
    const hasPiece = state.pieces[getPositionName(position)]

    if (hasMove != undefined)
      return onMoveClick(hasMove)
    if (hasPiece != undefined)
      return onPieceClick(hasPiece)
    return setState(prevState => ({ ...prevState, selected: undefined, selectedMoves: {} }))
  }

  const onPieceClick = (piece: Piece): void => {
    if (piece.color != state.playerMove || state.selected && piece.position.x === state.selected.position.x && piece.position.y === state.selected.position.y)
      return setState(prevState => ({ ...prevState, selected: undefined, selectedMoves: {} }))
    return setState(prevState => ({ ...prevState, selected: piece, selectedMoves: getPieceMoves(piece, state.pieces, false, state.lastMove) }))
  }

  const onMoveClick = (move: PieceMove): void => {
    const pieces = { ...state.pieces }
    if (state.selected == undefined)
      return undefined
    if (move.captured)
      delete pieces[getPositionName(move.captured.position)]
    if (move.type === MoveTypes.Q_CASTLING && delete pieces[getPositionName({ x: 0, y: move.position.y })])
      pieces[getPositionName({ x: 3, y: move.position.y })] = { ...state.pieces[getPositionName({ x: 0, y: move.position.y })], position: { x: 3, y: move.position.y }, hasMoved: true }
    if (move.type === MoveTypes.K_CASTLING && delete pieces[getPositionName({ x: 7, y: move.position.y })])
      pieces[getPositionName({ x: 5, y: move.position.y })] = { ...state.pieces[getPositionName({ x: 7, y: move.position.y })], position: { x: 5, y: move.position.y }, hasMoved: true }
    if (delete pieces[getPositionName(state.selected.position)])
      pieces[getPositionName(move.position)] = { ...state.pieces[getPositionName(state.selected.position)], position: move.position, hasMoved: true }

    const nextMoves = getPieceMoves(pieces[getPositionName(move.position)], pieces, true)
    const isCheck = !!Object.keys(nextMoves).find(key => {
      const currPiece = pieces[getPositionName(nextMoves[key].position)]
      if (currPiece == undefined)
        return undefined
      return currPiece.type === PieceTypes.KING
    })
    const historyMove = { id: HISTORY_MOVE_ID++, type: move.type, piece: state.selected, position: move.position, captured: move.captured, isCheck }
    const prevHistoryMoves = state.lastMove == undefined ? {} : Object.keys(state.historyMoves).reduce((r, key) => {
      if (state.lastMove && state.historyMoves[key].id > state.lastMove.id)
        return r
      return { ...r, [key]: { ...state.historyMoves[key] } }
    }, {})

    return setState(prevState => ({
      ...prevState,
      playerMove: prevState.playerMove === PlayerColor.WHITE ? PlayerColor.BLACK : PlayerColor.WHITE,
      pieces,
      selected: undefined,
      selectedMoves: {},
      historyMoves: { ...prevHistoryMoves, [historyMove.id]: historyMove },
      lastMove: historyMove,
      promotionPiece: move.promotion ? pieces[getPositionName(move.position)] : undefined
    }))
  }

  const onPromotionClick = (piece: Piece, type: PieceTypes.ROOK | PieceTypes.BISHOP | PieceTypes.QUEEN): void => {
    if (state.lastMove == undefined)
      return undefined
    const id = state.lastMove.id
    const pieces = { ...state.pieces, [getPositionName(piece.position)]: { ...piece, type } }
    const updateHistoryMove = { ...state.historyMoves[id], promotion: type }
    return setState(prevState => ({
      ...prevState,
      pieces,
      historyMoves: { ...prevState.historyMoves, [id]: updateHistoryMove },
      promotionPiece: undefined
    }))
  }

  const onHistoryMoveClick = (move: HistoryMove): void => {
    if (state.lastMove != undefined && move.id === state.lastMove.id)
      return undefined
    const reduceType = state.lastMove == undefined ? "reduce" : move.id > state.lastMove.id ? "reduce" : "reduceRight"
    const pieces = Object.keys(state.historyMoves)[reduceType]((r, key) => {
      const current = state.historyMoves[key]
      if (state.lastMove == undefined && current.id <= move.id)
        return forwardHistory(current, r)
      if (state.lastMove == undefined)
        return r
      if (current.id >  move.id && current.id <= state.lastMove.id)
        return backwardHistory(current, r)
      if (current.id <= move.id && current.id >  state.lastMove.id)
        return forwardHistory(current, r)
      return r
    }, { ...state.pieces })

    return updateAfterHistoryChange(move, pieces)
  }

  const onBackwardHistoryClick = (): void => {
    const historyMove = state.historyMoves[Object.keys(state.historyMoves).reverse().find(key => state.lastMove && state.historyMoves[key].id < state.lastMove.id) as string]
    if (historyMove == undefined && state.lastMove != undefined)
      return updateAfterHistoryChange(undefined, backwardHistory(state.lastMove, state.pieces))
    if (historyMove == undefined || state.lastMove == undefined)
      return undefined
    return updateAfterHistoryChange(historyMove, backwardHistory(state.lastMove, state.pieces))
  }

  const onForwardHistoryClick = (): void => {
    const historyMove = state.historyMoves[Object.keys(state.historyMoves).find(key => state.lastMove && state.historyMoves[key].id > state.lastMove.id) as string]
    if (historyMove == undefined && state.lastMove == undefined && Object.keys(state.historyMoves))
      return updateAfterHistoryChange(state.historyMoves[Object.keys(state.historyMoves)[0]], forwardHistory(state.historyMoves[Object.keys(state.historyMoves)[0]], state.pieces))
    if (historyMove == undefined || state.lastMove == undefined)
      return undefined
    return updateAfterHistoryChange(historyMove, forwardHistory(historyMove, state.pieces))
  }

  const updateAfterHistoryChange = (move: HistoryMove | undefined, pieces: Dictionary<Piece>): void => {
    const playerMove = move == undefined ? settings.startPlayer : getOppositeColor(move.piece.color)
    return setState(prevState => ({
      ...prevState,
      playerMove,
      pieces,
      selectedMoves: {},
      selected: undefined,
      lastMove: move,
      promotionPiece: undefined
    }))
  }

  const backwardHistory = (move: HistoryMove, pieces: Dictionary<Piece>): Dictionary<Piece> => {
    const temp = { ...pieces }
    if (delete temp[getPositionName(move.position)])
      temp[getPositionName(move.piece.position)] = { ...move.piece }
    if (move.type === MoveTypes.Q_CASTLING && delete temp[getPositionName({ x: 3, y: move.position.y })])
      temp[getPositionName({ x: 0, y: move.position.y })] = { ...pieces[getPositionName({ x: 3, y: move.position.y })], position: { x: 0, y: move.position.y }, hasMoved: false }
    if (move.type === MoveTypes.K_CASTLING && delete temp[getPositionName({ x: 5, y: move.position.y })])
      temp[getPositionName({ x: 7, y: move.position.y })] = { ...pieces[getPositionName({ x: 5, y: move.position.y })], position: { x: 7, y: move.position.y }, hasMoved: false }
    if (move.captured)
      temp[getPositionName(move.captured.position)] = { ...move.captured }
    return temp
  }

  const forwardHistory = (move: HistoryMove, pieces: Dictionary<Piece>): Dictionary<Piece> => {
    const temp = { ...pieces }
    if (move.captured)
      delete temp[getPositionName(move.captured.position)]
    if (move.type === MoveTypes.Q_CASTLING && delete temp[getPositionName({ x: 0, y: move.position.y })])
      temp[getPositionName({ x: 3, y: move.position.y })] = { ...pieces[getPositionName({ x: 0, y: move.position.y })], position: { x: 3, y: move.position.y }, hasMoved: true }
    if (move.type === MoveTypes.K_CASTLING && delete temp[getPositionName({ x: 7, y: move.position.y })])
      temp[getPositionName({ x: 5, y: move.position.y })] = { ...pieces[getPositionName({ x: 7, y: move.position.y })], position: { x: 5, y: move.position.y }, hasMoved: true }
    if (delete temp[getPositionName(move.piece.position)])
      temp[getPositionName(move.position)] = { ...move.piece, type: move.promotion ? move.promotion: move.piece.type, position: move.position, hasMoved: true }
    return temp
  }

  return (
    <React.Fragment>
      <div className="gameContainer">
        <GameMenu {...settings} onGameStart={onGameStart} />
        <Board
          playerMove={state.playerMove}
          pieces={state.pieces}
          selectedPosition={state.selected && state.selected.position}
          selectedMoves={state.selectedMoves}
          lastMove={state.lastMove}
          promotionPiece={state.promotionPiece}
          disabled={!settings.hasStarted || state.promotionPiece != undefined}
          onCellClick={onCellClick}
          onPromotionClick={onPromotionClick}
        />
      </div>
      <GameInformation
        historyMoves={state.historyMoves}
        lastMove={state.lastMove}
        isBackwardDisabled={isBackwardDisabled}
        isForwardDisabled={isForwardDisabled}
        onHistoryMoveClick={onHistoryMoveClick}
        onBackwardHistoryClick={onBackwardHistoryClick}
        onForwardHistoryClick={onForwardHistoryClick}
      />
    </React.Fragment>
  )
}

export default App
