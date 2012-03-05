const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function Logophile() {
  let jsd = Cc["@mozilla.org/js/jsd/debugger-service;1"]
              .getService(Ci.jsdIDebuggerService);
  jsd.asyncOn(this);
  this.lastException = { message: undefined, frames: [] };
  Cc["@mozilla.org/consoleservice;1"]
    .getService(Ci.nsIConsoleService)
    .registerListener({observe: this.observeMessage.bind(this)});
}

XPCOMUtils.defineLazyGetter(Logophile.prototype, "file", function() {
  let file =  Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD", Ci.nsIFile);
  file.append("logophile.log");
  let stream = Cc["@mozilla.org/network/file-output-stream;1"]
                 .createInstance(Ci.nsIFileOutputStream);
  stream.init(file,
              0x02|0x08|0x20 /* WRONLY | CREATE_FILE | TRUNCATE */,
              438 /*0666*/,
              0);
  let converter = Cc["@mozilla.org/intl/converter-output-stream;1"]
                    .createInstance(Ci.nsIConverterOutputStream);
  converter.init(stream, "UTF-8", 0, 0xFFFD);
  return converter;
});

XPCOMUtils.defineLazyGetter(Logophile.prototype, "prefs", function() {
});

/***** nsIObserver *****/
Logophile.prototype.observe = function Logophile_observe(aSubject, aTopic, aData) {
  /* nothing */
};

/***** nsIConosoleListener *****/
Logophile.prototype.observeMessage = function Logophile_observeMessage(aMessage) {
  let message = aMessage.message;
  if (aMessage instanceof Ci.nsIScriptError) {
    message = aMessage.errorMessage;
  }
  this.file.writeString(message + "\n");
  if (message === this.lastException.message) {
    for each (let frame in this.lastException.frames) {
      this.file.writeString("\t" + frame + "\n");
    }
  } else {
    if (aMessage instanceof Ci.nsIScriptError) {
      this.file.writeString("\t" +
                            (aMessage.sourceName ? aMessage.sourceName : "") +
                            (aMessage.lineNumber ? " line " + aMessage.lineNumber : "") +
                            (aMessage.columnNumber ? " : " + aMessage.columnNumber : "") +
                            "\n");
      if (aMessage.sourceLine) {
        this.file.writeString("\t" + aMessage.sourceLine + "\n");
      }
    }
    this.file.writeString("\t[stack unavailable]\n");
  }
};

/***** jsdIExecutionHook *****/
Logophile.prototype.onExecute =
function Logophile_onExecute(aFrame, aType, aVal) {
  try {
    /*
    this.file.writeString(aMessage + "\n");
    let exc = aExc.getWrappedValue();
    for each (let frame in (exc.stack || "").split(/\n/)) {
      this.file.writeString("\t" + frame + "\n");
    }
    */
    /*
    let props = {}, val = aVal.value.getWrappedValue();
    try {
      for (let proto = val; proto !== null; proto = Object.getPrototypeOf(proto)) {
        Object.getOwnPropertyNames(proto).forEach(function(n) props[n] = true);
      }
      this.file.writeString("\t" + Object.keys(props).sort() + "\n");
    } catch (ex) {
      this.file.writeString("\t" + val + "\n");
    }
    */
    let exception = {};
    if (aVal.value.isNumber) {
      let name = Object.keys(Cr).filter(function(n) /^NS_/.test(n) && Cr[n] === aVal.value.doubleValue);
      if (name) {
        exception.message = name.pop();
      } else {
        exception.message = "0x" + aVal.value.doubleValue.toString(16);
      }
    } else {
      exception.message = aVal.value.getWrappedValue().message;
    }
    if (exception.message == "NS_ERROR_NO_INTERFACE") {
      return undefined; // skip these
    }
    exception.frames = [];
    for (let frame = aFrame; frame; frame = frame.callingFrame) {
      if (frame.isDebugger) continue;
      exception.frames.push((frame.functionName || "") +
                            (frame.script ? " @ " + frame.script.fileName : "") +
                            (frame.line ? " line " + frame.line : ""));
    }
    if (exception.message == this.lastException.message &&
        this.lastException.frames.slice(-exception.frames.length).join("\n") == exception.frames.join("\n"))
    {
      // repeated exception
    } else {
      // new exception
      this.file.writeString(exception.message + "\n");
      for each (let frame in exception.frames) {
        this.file.writeString("\t" + frame + "\n");
      }
      this.lastException = exception;
    }
  } catch (ex) {
    Components.utils.reportError(ex);
  } finally {
    return Ci.jsdIExecutionHook.RETURN_CONTINUE_THROW;
  }
};

/***** jsdIActivationCallback *****/
Logophile.prototype.onDebuggerActivated = function Logophile_onDebuggerActivated() {
  let jsd = Cc["@mozilla.org/js/jsd/debugger-service;1"]
              .getService(Ci.jsdIDebuggerService);
  jsd.throwHook = this;
  jsd.flags = Ci.jsdIDebuggerService.ENABLE_NATIVE_FRAMES;
};

Logophile.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.nsIObserver,
                         Ci.jsdIExecutionHook,
                         Ci.jsdIActivationCallback]);

Logophile.prototype.classID =
  Components.ID("{a95116d1-a818-44ac-a865-04165b166e7e}");

const NSGetFactory = XPCOMUtils.generateNSGetFactory([Logophile]);
