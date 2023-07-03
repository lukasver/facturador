import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config();
import INVOICE_DATA_JSON from './csv.json';
import { Invoice } from './interfaces';
import {
  navigateToFacturadorPage,
  sleep,
  error,
  addAccomodationDataToInvoice,
  addExpensesDataToInvoice,
  formatNumber,
  startNewInvoice,
} from './functions';

const INVOICE_DATA = INVOICE_DATA_JSON as Invoice[];

const LOGIN_SUFFIX = 'contribuyente_/login.xhtml';
const BASE_URL = 'https://auth.afip.gob.ar/';

enum idTipoDocReceptor {
  DNI = '96',
  CUIT = '80',
}

const today = new Date();
const currentDateNumber = today.getDate();
const invoicingMonth =
  // getMonth starts from 0 (jan === 0)
  currentDateNumber < 10 && currentDateNumber > 0
    ? today.getMonth()
    : today.getMonth() + 1;

console.debug(
  `INVOICES WILL BE ISSUED WITH DATE: ${currentDateNumber}/${invoicingMonth}/${today.getFullYear()}`
);

(async () => {
  async function main() {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const page = await browser.newPage();
    await page.goto(BASE_URL + LOGIN_SUFFIX);
    const facturadorPage = await navigateToFacturadorPage(page);

    facturadorPage.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    for (const invoiceData of INVOICE_DATA) {
      await sleep(facturadorPage, 1000);
      console.debug(
        `⏳ Issuing ${invoiceData.resident} invoice for ${invoiceData?.accomodation?.value} ...`
      );
      await startNewInvoice(facturadorPage);
      // INICIO CREACIón FACTURA
      await facturadorPage
        .locator('select[name="puntoDeVenta"]')
        .selectOption('1');
      await facturadorPage.locator('text=Continuar >').click();

      // Select invoice date
      const today = new Date();
      //TODO ! check if current month is not month of facturation
      const date = `${currentDateNumber}/${invoicingMonth}/${today.getFullYear()}`;
      const dateInput = facturadorPage.locator(
        'input[name="fechaEmisionComprobante"]'
      );
      await dateInput.fill('');
      await dateInput.fill(date);

      // Select invoice type
      await facturadorPage
        .locator('select[name="idConcepto"]')
        .selectOption('2'); // Servicios
      await facturadorPage.locator('text=Continuar >').click();

      // Fill invoice header data
      await facturadorPage
        .locator('select[name="idIVAReceptor"]')
        .selectOption('5'); // Consumidor final

      const documentType = idTipoDocReceptor[invoiceData.idType];
      if (!documentType)
        error(
          new Error(
            `Document Type is mandatory and should either be DNI or CUIT
            ${invoiceData.resident}`
          )
        );

      await facturadorPage
        .locator('select[name="idTipoDocReceptor"]')
        .selectOption(documentType);
      await facturadorPage
        .locator('input[name="nroDocReceptor"]')
        .fill(invoiceData.id); // completar con DNI/CUIT NUMBER

      const addressInput = facturadorPage.locator(
        'input[name="domicilioReceptor"]'
      );
      if (documentType === idTipoDocReceptor.DNI) {
        await facturadorPage
          .locator('input[name="razonSocialReceptor"]')
          .fill(invoiceData.payerfullName); // Razon social
        await addressInput.fill(invoiceData.address); // domicilio
      } else {
        // a timeout to wait autofill of imputs if CUIT data exists
        await sleep(facturadorPage, 2500);
        const currentValue = await addressInput.getAttribute('value');
        if (!currentValue) {
          await addressInput.fill(invoiceData.address);
        }
      }

      await facturadorPage.locator('#formadepago4').check(); // Forma de pago: cuenta corriente
      await facturadorPage.locator('text=Continuar >').click();

      // Fill invoice body data
      await addAccomodationDataToInvoice(
        facturadorPage,
        invoiceData.accomodation
      );
      if (invoiceData.expenses) {
        await addExpensesDataToInvoice(facturadorPage, invoiceData.expenses);
      }
      await facturadorPage.keyboard.press('Tab');
      await sleep(facturadorPage, 100);

      const inputTotalValue = await facturadorPage
        .locator('input[name="impTotal"]')
        .inputValue();

      const totalValue = formatNumber(
        Number(invoiceData.accomodation.value) +
          (invoiceData.expenses ? Number(invoiceData.expenses.value) : 0)
      );

      if (formatNumber(Number(inputTotalValue)) !== totalValue) {
        console.debug(
          'inputtotalvalue',
          inputTotalValue,
          typeof inputTotalValue
        );
        console.debug('totalvalue', totalValue, typeof totalValue);
        error(new Error(`Total values don't match ${invoiceData.resident}`));
      } // assert value in the input is equal to total value of invoice

      await facturadorPage.locator('text=Continuar >').click();

      // maybe assert document number is correct if not fails?
      await facturadorPage.locator(`text=${invoiceData.id}`).waitFor();
      // maybe assert total value is correct if not fails?
      await facturadorPage.locator(`b:has-text("${totalValue}")`).waitFor();

      // confirm invoice issuance:
      await facturadorPage.locator('text=Confirmar Datos...').click();
      // Print pdf
      const [download] = await Promise.all([
        facturadorPage.waitForEvent('download'),
        facturadorPage.locator('text=Imprimir...').click(),
      ]);
      await download.saveAs(
        `invoices/factura-${today.getFullYear()}${invoicingMonth}-${
          invoiceData.resident
        }${
          invoiceData?.accomodation?.description?.includes('Matricula')
            ? '-matricula'
            : ''
        }.pdf`
      );
      await download.delete();
      // Click text=Menú Principal

      await facturadorPage.locator('text=Menú Principal').click();

      // if (
      //   !(await page
      //     .url()
      //     .includes('https://fe.afip.gob.ar/rcel/jsp/menu_ppal.jsp'))
      // ) {
      //   error(new Error(`Incorrect page title: ${invoiceData.resident}`));
      // }
      console.debug(`✅ Invoice issued successfully: ${invoiceData.resident}`);
    }
    await browser.close();
  }
  await main();
})();
