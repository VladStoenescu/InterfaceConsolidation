const page = arguments[0];
const container = await page.$('.hierarchy-container');
if (container) {
    await container.evaluate(el => el.scrollTop = 100);
}
