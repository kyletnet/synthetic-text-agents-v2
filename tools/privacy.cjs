function maskPII(s){
  if(!s) return s;
  return String(s)
    // emails
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[EMAIL]')
    // phones (intl-ish)
    .replace(/\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g,'[PHONE]')
    // id-like ( 주민/사업자 등 단순 패턴 가드 )
    .replace(/\b\d{2,3}[- ]?\d{2,3}[- ]?\d{4,5}\b/g,'[ID]');
}
module.exports = { maskPII };
