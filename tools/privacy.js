function maskPII(s){
  if(!s) return s;
  return String(s)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[EMAIL]')
    .replace(/\b(\+?\d{1,3}[-.\s]?)?(\d{2,4}[-.\s]?){2,4}\d{3,4}\b/g,'[PHONE]')
    .replace(/\b[0-9]{6,}\b/g,'[NUM]')
    .replace(/(?:주민등록번호|SSN)\s*[:\-]?\s*\d{3}[- ]?\d{2}[- ]?\d{4}/gi,'[ID]');
}
module.exports={ maskPII };