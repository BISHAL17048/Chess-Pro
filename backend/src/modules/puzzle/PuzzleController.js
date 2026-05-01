export default class PuzzleController {
  static async getRandomPuzzle(req, res) {
    try {
      // Mock random puzzle response
      const puzzle = {
        id: '12345',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
        moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Nc3', 'Bc5'],
        rating: 1500,
        themes: ['opening', 'fork']
      }
      return res.status(200).json({
        success: true,
        data: puzzle
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async getDailyPuzzle(req, res) {
    try {
      // Mock daily puzzle
      const puzzle = {
        id: 'daily-20231015',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
        moves: ['O-O'],
        rating: 1800,
        themes: ['mateIn2', 'sacrifice']
      }
      return res.status(200).json({
        success: true,
        data: puzzle
      })
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}
