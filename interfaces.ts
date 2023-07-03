export interface Invoice {
  idType: ID_TYPE;
  id: string;
  address: string;
  payerfullName: string;
  resident: string;
  month: string;
  day?: string;
  accomodation: Expense;
  expenses?: Expense;
}

export interface Expense {
  amount: string;
  value: string;
  code: EXPENSE_CODE;
  description: string;
}
export enum ID_TYPE {
  DNI = 'DNI',
  CUIT = 'CUIT',
}

export enum EXPENSE_CODE {
  ServicioDeHospedaje = '001',
  GastosAdministrativos = '002',
  MatriculaInscripción = '003',
  Penalidad = '005',
}

export enum EXPENSE_DESCRIPTION {
  ServicioDeHospedaje = 'Servicio de hospedaje',
  GastosAdministrativos = 'Gastos administrativos',
  MatriculaInscripción = 'Matricula de inscripción',
  Penalidad = 'Penalidad por retiro anticipado',
}
