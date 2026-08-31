export default async function run(page, ui) {
  await page.goto('about:blank')
  await page.goto('http://localhost:5174/#/acesso/11144477735')
  await page.waitForTimeout(1200)
  const antes = await page.evaluate(() => document.body.innerText.slice(0, 300))
  const inputs = page.locator('input[inputmode=numeric]')
  const n = await inputs.count()
  if (n > 0) {
    await inputs.first().fill('111.444.777-35')
    await page.getByRole('button', { name: /Entrar/i }).last().click()
    await page.waitForTimeout(800)
  }
  const depois = await page.evaluate(() => document.body.innerText.slice(0, 900))
  return { antes, n, depois }
}
