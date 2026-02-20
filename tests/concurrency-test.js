const base = 'http://localhost:3000';
const keyA = require('uuid').v4();
const keyB = require('uuid').v4();

async function spend(id, key) {
  const res = await fetch(`${base}/spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ownerId: 'Chakradhar',
      amount: 700,
      idempotencyKey: key,
      description: `Concurrent test ${id}`
    })
  });
  return await res.json();
}

Promise.all([
  spend('A', keyA),
  spend('B', keyB)
]).then(results => console.log(results));