# Gaggle

[![Build Status](https://img.shields.io/circleci/project/ben-ng/gaggle/master.svg)](https://circleci.com/gh/ben-ng/gaggle/tree/master) ![Code Coverage](https://img.shields.io/badge/code%20coverage-100%25-brightgreen.svg)

Gaggle is a keyed mutex. It abstracts over different [Strategies](#strategies) for mutual exclusion, so you can choose your own tradeoffs.

## Strategies

Distributed strategies require the use of a [Channel](#channels)

Strategy  | Distributed? | Failure Tolerance                                                            | Description
--------- | ------------ | ---------------------------------------------------------------------------- | ----------------
Redis     | No           | Requires Redis to work, but processes can fail as locks automatically expire | Uses `SET EX NX`

## Channels

Channel | Options
------- | -------
Redis   | <ul><li>**String** redisChannel *required*</li><li>**String** redisConnectionString `redis://user:pass@host:port`</li></ul>

## Examples

### Atomic Increment

Multile processes are simultaneously trying to increment the same value in a database that only supports "GET" and "SET" commands. A situation like this might arise:

```
Process A:
1. GET x => 0
2. SET x 1

Process B:
1. GET x => 0
2. SET x 1

Result: x = 1
Expected: x = 2
```

This is known as the "lost update" problem. You can solve this problem with Gaggle like this:

```js

var Gaggle = require('gaggle').Redis// Gaggle behaves the same way with any strategy & channel
  , g = new Gaggle()
  , db = require('your-hypothetical-database')

g.lock('myLock', {    // You can create multiple locks by naming them
  duration: 1000      // Hold the lock for no longer than 1 second
, maxWait: 5000       // Wait for no longer than 5s to acquire the lock
})
.then(lock => {
  // Begin critical section
  return db.get('x')
  .then(value => {
    return db.set('x', value + 1)
  })
  // End critical section
  .then(() => {
    return g.unlock(lock)
  })
})
.catch(err => {
  // Handle any errors. No need to release the lock as it will
  // automatically expire if the db.get or db.set commands failed.
})

```

By enclosing the `GET` and `SET` commands within the critical section, we guarantee that updates are not lost.

## License

Copyright (c) 2015 Ben Ng <me@benng.me>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
