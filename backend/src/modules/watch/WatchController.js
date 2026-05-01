export default class WatchController {
  static async getActiveBroadcasts(req, res) {
    try {
      // Mock active broadcasts
      const broadcasts = [
        {
          id: 'candidates-2024',
          name: 'FIDE Candidates 2024',
          status: 'live',
          viewers: 15400
        },
        {
          id: 'tata-steel-2024',
          name: 'Tata Steel Chess Tournament',
          status: 'finished',
          viewers: 0
        }
      ]
      return res.status(200).json({
        success: true,
        data: broadcasts
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getBroadcastDetails(req, res) {
    try {
      const { broadcastId } = req.params
      const broadcast = {
        id: broadcastId,
        name: `Tournament ${broadcastId}`,
        status: 'live',
        games: [
          {
            id: 'game1',
            white: 'Magnus Carlsen',
            black: 'Fabiano Caruana',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          }
        ]
      }
      return res.status(200).json({
        success: true,
        data: broadcast
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}
