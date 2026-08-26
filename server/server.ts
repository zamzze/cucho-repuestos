import express from 'express'
import cors from 'cors'

import { partsRouter } from './routes/parts'
import { familiesRouter } from './routes/families'
import { modelsRouter } from './routes/models'

const app = express()

const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'MPC API',
  })
})

app.use('/api/parts', partsRouter)
app.use('/api/families', familiesRouter)
app.use('/api/models', modelsRouter)

app.listen(PORT, () => {
  console.log('')
  console.log('=================================')
  console.log(' MPC API')
  console.log('=================================')
  console.log('')
  console.log(`Servidor: http://localhost:${PORT}`)
  console.log(`Health:   http://localhost:${PORT}/api/health`)
  console.log('')
})