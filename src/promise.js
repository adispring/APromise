const State = { Pending: 0, Fulfilled: 1, Rejected: 2 };

const isFunction = val => typeof val === 'function';
const isObject = val => val && typeof val === 'object';

const spy = scope => {
  let called = false;
  return (fn, context) => (...args) =>
    called || ((called = true) && fn.apply(context || scope, args));
};

const promiseResolution = (promise, x) => {
  if (promise === x) {
    promise.reject(new TypeError('circular reference'));
  } else if (isObject(x) || isFunction(x)) {
    const once = spy(promise);
    try {
      const xthen = x.then;
      if (isFunction(xthen)) {
        xthen.call(
          x,
          once(y => promiseResolution(promise, y)),
          once(promise.reject)
        );
      } else {
        promise.fulfill(x);
      }
    } catch (e) {
      once(promise.reject)(e);
    }
  } else {
    promise.fulfill(x);
  }
};

class APromise {
  constructor(executor) {
    this.state = State.Pending;
    this.x = null;
    this.callbacks = [];
    executor(this.fulfill.bind(this), this.reject.bind(this));
  }
  transition(state, x) {
    if (this.state === State.Pending) {
      this.state = state;
      this.x = x;
      this.callbacks.forEach(cb => cb());
    }
  }
  fulfill(value) {
    this.transition(State.Fulfilled, value);
  }
  reject(reason) {
    this.transition(State.Rejected, reason);
  }
  then(onFulfilled, onRejected) {
    const promise2 = new APromise(() => {});
    const schedulePromise2Resolution = () => {
      process.nextTick(() => {
        const onFulfill = isFunction(onFulfilled) ? onFulfilled : v => v;
        const onReject = isFunction(onRejected)
          ? onRejected
          : r => {
              throw r;
            };
        const onHandler = this.state === State.Fulfilled ? onFulfill : onReject;
        try {
          const x = onHandler(this.x);
          promiseResolution(promise2, x);
        } catch (e) {
          promise2.reject(e);
        }
      });
    };
    if (this.state === State.Pending) {
      this.callbacks.push(schedulePromise2Resolution);
    } else {
      schedulePromise2Resolution();
    }
    return promise2;
  }
}

module.exports = APromise;
