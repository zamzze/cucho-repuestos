import {
  exportDatabase,
} from '../db/sqlite'

export async function downloadDatabase() {
  const data =
    await exportDatabase()

  const buffer =
    new ArrayBuffer(
      data.byteLength,
    )

  new Uint8Array(
    buffer,
  ).set(data)

  const blob =
    new Blob(
      [buffer],
      {
        type:
          'application/vnd.sqlite3',
      },
    )

  const url =
    URL.createObjectURL(
      blob,
    )

  const now =
    new Date()

  const date =
    [
      now.getFullYear(),
      String(
        now.getMonth() + 1,
      ).padStart(2, '0'),
      String(
        now.getDate(),
      ).padStart(2, '0'),
    ].join('-')

  const time =
    [
      String(
        now.getHours(),
      ).padStart(2, '0'),
      String(
        now.getMinutes(),
      ).padStart(2, '0'),
    ].join('')

  const anchor =
    document.createElement('a')

  anchor.href = url

  anchor.download =
    `MPC_REPUESTOS_${date}_${time}.db`

  document.body.appendChild(
    anchor,
  )

  anchor.click()

  anchor.remove()

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url,
      ),
    1000,
  )
}