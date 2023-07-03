import { Page } from 'playwright';
import { Expense, ID_TYPE } from './interfaces';

const LOGIN_SUFFIX = 'contribuyente_/login.xhtml';
const USERNAME = process.env.AFIP_USERNAME!;
const PASSWORD = process.env.AFIP_PASSWORD!;
const CUIT_USR_FACTURADOR = process.env.AFIP_ISSUER_CUIT!;
const BASE_URL = 'https://auth.afip.gob.ar/';

if (!USERNAME || !PASSWORD || !CUIT_USR_FACTURADOR) {
  throw new Error(
    'Username, password and facturador are mandatory, check your env vars'
  );
}

export const addExpensesDataToInvoice = async (
  page: Page,
  expenses: Expense
) => {
  await page.locator('text=Agregar línea descripción').click(); // Adds a new line for adding extra expenses
  await page
    .locator('input[name="detalleCodigoArticulo"]')
    .nth(1)
    .fill(expenses.code);
  await page.locator('#detalle_descripcion2').fill(expenses.description);
  await page.locator('#detalle_cantidad2').fill(expenses.amount);
  await page.locator('#detalle_precio2').fill(expenses.value);
};

export const addAccomodationDataToInvoice = async (
  page: Page,
  expenses: Expense
) => {
  await page.locator('input[name="detalleCodigoArticulo"]').fill(expenses.code); // codigo de articulo;
  await page
    .locator('textarea[name="detalleDescripcion"]')
    .fill(expenses.description); // descripción de articulo;
  await page.locator('input[name="detalleCantidad"]').fill(expenses.amount); // cantidad nominal de articulo;
  await page.locator('input[name="detallePrecio"]').fill(expenses.value); // precio unitario articulo;
};

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
};

export const startNewInvoice = async (page: Page) => {
  await page
    .locator('a[role="button"]:has-text("Generar Comprobantes")')
    .click();
  if (
    !(await page
      .url()
      .includes('https://fe.afip.gob.ar/rcel/jsp/buscarPtosVtas.do'))
  ) {
    error(new Error('Incorrect page title'));
  }
};

export const sleep = async (page: Page, millis: number) =>
  await page.waitForTimeout(millis || 1000);

export const logInUser = async (page: Page) => {
  const loginInput = page.locator('input[id="F1:username"]');
  await loginInput.waitFor();
  await loginInput.fill(USERNAME);
  const submitInput = page.locator('input[id="F1:btnSiguiente"]');

  await Promise.all([page.waitForNavigation(), submitInput.click()]);

  const passwordInput = await page.locator('input[name="F1\\:password"]');
  await passwordInput.waitFor();
  await passwordInput.fill(PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.locator('input[alt="Ingresar"]').click(),
  ]);
};

export const navigateToFacturadorPage = async (page: Page) => {
  await page.goto(BASE_URL + LOGIN_SUFFIX);
  if ((await page.title()) !== 'Acceso con Clave Fiscal - AFIP') {
    error(new Error('Incorrect page title'));
  }
  await logInUser(page);
  // await page.locator('span:has-text("Mis Servicios")').click();
  const [portalMonotributoPage] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('h3:has-text("Monotributo")').click(),
  ]);
  await portalMonotributoPage
    .locator(`//a[@usr="${CUIT_USR_FACTURADOR}"]`)
    .click();

  const url = await portalMonotributoPage.url();
  if (!url.includes('https://monotributo.afip.gob.ar/app/Inicio.aspx')) {
    error(new Error('Incorrect page URL'));
  }

  const [facturadorPage] = await Promise.all([
    portalMonotributoPage.waitForEvent('popup'),
    portalMonotributoPage.locator('text=Emitir Factura').click(),
  ]);

  await logInUser(facturadorPage);

  const facturadorUrl = await facturadorPage.url();
  if (
    !facturadorUrl.includes('https://fe.afip.gob.ar/rcel/jsp/index_bis.jsp')
  ) {
    error(new Error('Incorrect page url'));
  }

  await facturadorPage.locator(`text=${process.env.RAZON_SOCIAL}`).click();
  return facturadorPage;
};

export const error = async (error: Error) => {
  console.log(error.message);
  console.error(error);
  process.exit(1);
};

export interface CSVRecord {
  MES: string;
  Comprobante: string;
  'N° Comp': string;
  FECHA: string;
  MATRICULA: string;
  HOSPEDAJE: string;
  SERVICIOS: string;
  TOTAL: string;
  PAGADOR: string;
  RESIDENTE: string;
  'Tipo doc': ID_TYPE;
  Documento: string;
  DIRECCION: string;
}
