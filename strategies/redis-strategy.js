var StrategyInterface = require('./strategy-interface')
  , redis = require('redis')
  , Joi = require('joi')
  , util = require('util')
  , Promise = require('bluebird')
  , async = require('async')
  , _ = require('lodash')
  , uuid = require('uuid')
  , LOCK_MODES = require('../lock-modes')
  , prettifyJoiError = require('../helpers/prettify-joi-error')

Promise.promisifyAll(redis.RedisClient.prototype)

/**
* A naive solution to mutual exclusion, mostly so that the test suite can be
* tested, but good in situations where simplicity is more important than
* high performance. For example, you might want to use this to run migrations
* on deploy of an 12-factor app with multiple processes.
*/

function RedisStrategy (opts) {
  var validatedOptions = Joi.validate(opts || {}, Joi.object().keys({
        strategyOptions: Joi.object().keys({
          redisConnectionString: Joi.string()
        })
      }), {
        convert: false
      })
    , connString
    , redisClient

  StrategyInterface.apply(this, Array.prototype.slice.call(arguments))

  if (validatedOptions.error != null) {
    throw new Error(prettifyJoiError(validatedOptions.error))
  }

  connString = _.get(validatedOptions, 'value.strategyOptions.redisConnectionString')
  redisClient = connString != null ? redis.createClient(connString) : redis.createClient()

  redisClient.on('error', this._log)

  this._redis = redisClient
}

util.inherits(RedisStrategy, StrategyInterface)

RedisStrategy.prototype._setLockState = function _setLockState (key, opts) {
  var acquired = false
    , started = Date.now()
    , MAX_WAIT = opts.maxWait
    , LOCK_DURATION = opts.lockDuration
    , r = this._redis
    , newNonce = this.id + '_' + uuid.v4()

  if (opts.mode === LOCK_MODES.NONE) {
    return r.getAsync(key)
    .then(function (res) {
      if (res === opts.lockNonce) {
        return r.delAsync(key)
      }
      else {
        return Promise.resolve()
      }
    })
  }
  else {
    return new Promise(function (resolve, reject) {
      async.whilst(function () {
        return acquired === false && Date.now() - started < MAX_WAIT
      }, function (next) {
        r.set(key, newNonce, 'NX', 'PX', LOCK_DURATION, function (err, res) {
          if (err) {
            setTimeout(next, _.random(150, 300))
          }
          else if (res === 'OK') {
            acquired = {
              key: key
            , nonce: newNonce
            }
            next(null)
          }
          else {
            // "try again later" -- fail with no error
            setTimeout(next, _.random(150, 300))
          }
        })
      }, function (err) {
        if (err) {
          reject(new Error('Could not acquire lock: ' + err.message))
        }
        else if (acquired != null) {
          resolve(acquired)
        }
        else {
          reject(new Error('Timed out before acquiring the lock'))
        }
      })
    })
  }
}

RedisStrategy.prototype._close = function _close () {
  this._redis.quit()

  return Promise.resolve()
}

module.exports = RedisStrategy
