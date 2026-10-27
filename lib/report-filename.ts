export function reportFilename(className:string, date=new Date()) {
  const name=className.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'-').trim().replace(/[. ]+$/g,'').slice(0,100)||'classroom';
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  return `${name}-${day}.pdf`;
}
