import * as jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const secret = 'ctP0xjiTo0A834oWIE1bTnfuprtbt6Qk3EDsRwFNVxNE=';
const token = jwt.sign({ sub: 'user1', role: 'admin', storeId: '2b43b169-23f2-4ed0-b747-920f07df59ed' }, secret);

fetch('http://localhost:3001/api/v1/inventory/batches/a433c66c-eca3-403f-a872-677ae1840037', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
});
