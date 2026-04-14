const DEPARTMENT_BY_CODE = {
  UFIE: 'First Year',
  UFIA: 'First Year',
  UCSE: 'CSE',
  UITE: 'CSE',
  UADS: 'CSE',
  UCHE: 'Chemical',
  UPIE: 'P&I',
  UPTR: 'Petroleum',
  UECE: 'Electronics',
  UECC: 'Electronics',
  UEEE: 'Electronics',
  UELE: 'Electrical',
  UMIE: 'Mining',
  UCIV: 'Civil',
  UMEC: 'Mechanical',
};

const ROLL_NUMBER_REGEX = /^\d{2}[A-Za-z]{4}\d+$/;

const normalizeDepartment = (value) => {
  if (!value) return '';
  const cleaned = String(value).trim().toLowerCase();
  const map = {
    'first year': 'First Year',
    firstyear: 'First Year',
    cse: 'CSE',
    chemical: 'Chemical',
    'p&i': 'P&I',
    'p and i': 'P&I',
    petroleum: 'Petroleum',
    electronics: 'Electronics',
    electrical: 'Electrical',
    mining: 'Mining',
    civil: 'Civil',
    mechanical: 'Mechanical',
  };
  return map[cleaned] || value;
};

const getDepartmentFromRollNumber = (rollNumber) => {
  if (!rollNumber || !ROLL_NUMBER_REGEX.test(String(rollNumber).trim())) return null;
  const code = String(rollNumber).trim().toUpperCase().slice(2, 6);
  return DEPARTMENT_BY_CODE[code] || null;
};

const validateRollAndDepartment = (rollNumber, department) => {
  const normalizedRoll = String(rollNumber || '').trim().toUpperCase();
  const normalizedDepartment = normalizeDepartment(department);

  if (!ROLL_NUMBER_REGEX.test(normalizedRoll)) {
    return {
      isValid: false,
      message: 'Roll number format is invalid. Expected format like 23UADS2122.',
    };
  }

  const mappedDepartment = getDepartmentFromRollNumber(normalizedRoll);
  if (!mappedDepartment) {
    return {
      isValid: false,
      message: 'Roll number department code is not recognized.',
    };
  }

  if (!normalizedDepartment) {
    return {
      isValid: false,
      message: 'Department is required.',
    };
  }

  if (mappedDepartment !== normalizedDepartment) {
    return {
      isValid: false,
      message: `Department mismatch. Roll number maps to ${mappedDepartment}.`,
      expectedDepartment: mappedDepartment,
    };
  }

  return {
    isValid: true,
    expectedDepartment: mappedDepartment,
    normalizedRoll,
    normalizedDepartment,
  };
};

module.exports = {
  DEPARTMENT_BY_CODE,
  ROLL_NUMBER_REGEX,
  normalizeDepartment,
  getDepartmentFromRollNumber,
  validateRollAndDepartment,
};
