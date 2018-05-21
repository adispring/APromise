const State = { Pending: 0, Fulfilled: 1, Rejected: 2 };

const isFunction = val => typeof val === 'function';
const isObject = val => val && typeof val === 'object';
const functionWithFallback = (f, fallback) => (isFunction(f) ? f : fallback);

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
    this.handlers = [];
    executor(this.fulfill.bind(this), this.reject.bind(this));
  }
  transition(state, x) {
    if (this.state === State.Pending) {
      this.state = state;
      this.x = x;
      this.handlers.forEach(handler => handler());
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
    const scheduleHandler = () => {
      process.nextTick(() => {
        const onHandler =
          this.state === State.Fulfilled
            ? functionWithFallback(onFulfilled, v => v)
            : functionWithFallback(onRejected, r => {
                throw r;
              });
        try {
          const x = onHandler(this.x);
          promiseResolution(promise2, x);
        } catch (e) {
          promise2.reject(e);
        }
      });
    };
    if (this.state === State.Pending) {
      this.handlers.push(scheduleHandler);
    } else {
      scheduleHandler();
    }
    return promise2;
  }
}

module.exports = APromise;
