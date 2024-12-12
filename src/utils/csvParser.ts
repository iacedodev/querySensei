import Papa from 'papaparse';

interface PatientData {
  rm_id: string;
  igs: string;
  p_psicosalud: string;
  p_alimentacion: string;
  p_corazon: string;
  p_tabaco: string;
  p_cancer: string;
  p_osteomuscular: string;
  p_hepatico: string;
  tra_nombre: string;
  tra_apellidos: string;
  [key: string]: string;
}

let patientData: PatientData[] = [];

export function parseCSV(csvString: string): Promise<PatientData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<PatientData>(csvString, {
      header: true,
      complete: (results) => {
        patientData = results.data;
        resolve(patientData);
      },
      error: (error: Error) => {
        reject(error);
      }
    });
  });
}

export function getPatientDataByRmId(rmId: string): PatientData | undefined {
  return patientData.find(patient => patient.rm_id === rmId);
}

export function getHealthDataForChart(searchTerm: string): { current: { [key: string]: number | string }, future: { [key: string]: number | string } } | null {
  console.log('Searching for:', searchTerm);
  console.log('Total patients in data:', patientData.length);
  
  const normalizeString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedSearchTerm = normalizeString(searchTerm);

  const patient = patientData.find(p => {
    const fullName = `${p.tra_nombre} ${p.tra_apellidos}`;
    return normalizeString(fullName).includes(normalizedSearchTerm) ||
           normalizeString(p.rm_id).includes(normalizedSearchTerm);
  });
  
  if (!patient) {
    console.log('Patient not found');
    return null;
  }

  console.log('Patient found:', patient);

  return {
    current: {
      alimentacion: parseFloat(patient.p_alimentacion),
      psicosalud: parseFloat(patient.p_psicosalud),
      cancer: parseFloat(patient.p_cancer),
      corazon: parseFloat(patient.p_corazon),
      tabaco: parseFloat(patient.p_tabaco),
      hepatico: parseFloat(patient.p_hepatico),
      osteomuscular: parseFloat(patient.p_osteomuscular),
      patientName: `${patient.tra_nombre} ${patient.tra_apellidos}`,
      igs: parseFloat(patient.igs)
    },
    future: {
      alimentacion: parseFloat(patient.p_alimentacion_f),
      psicosalud: parseFloat(patient.p_psicosalud_f),
      cancer: parseFloat(patient.p_cancer_f),
      corazon: parseFloat(patient.p_corazon_f),
      tabaco: parseFloat(patient.p_tabaco_f),
      hepatico: parseFloat(patient.p_hepatico_f),
      osteomuscular: parseFloat(patient.p_osteomuscular_f),
      igs: parseFloat(patient.igs_f)
    }
  };
}

export function getAllIgsScores(): { name: string, current: number, future: number }[] {
  return patientData.map(patient => ({
    name: `${patient.tra_nombre} ${patient.tra_apellidos}`,
    current: parseFloat(patient.igs),
    future: parseFloat(patient.igs_f)
  }));
}
