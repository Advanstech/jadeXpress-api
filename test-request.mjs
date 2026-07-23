import jwt from 'jsonwebtoken';

const secret = 'ctP0xjiTo0A834oWIE1bTnfuprtbt6Qk3EDsRwFNVxNE=';
const token = jwt.sign({ sub: 'user1', role: 'admin', storeId: '2b43b169-23f2-4ed0-b747-920f07df59ed' }, secret);

const res = await fetch('http://localhost:3001/api/v1/inventory/batches/a433c66c-eca3-403f-a872-677ae1840037', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
console.log(res.status);
console.log(await res.text());
