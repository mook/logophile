const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function Logophile() {
  let jsd = Cc["@mozilla.org/js/jsd/debugger-service;1"]
              .getService(Ci.jsdIDebuggerService);
  jsd.asyncOn(this);
  this.lastException = { message: undefined, frames: [] };
  let messages = {};
  this._consoleService.getMessageArray(messages, {});
  for each (let message in messages.value) {
    this.observeMessage(message);
  }
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

/***** jsdIExecutionHook *****/
Logophile.prototype.onExecute =
function Logophile_onExecute(aFrame, aType, aVal) {
  try {
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
      this.lastException = exception;
      if (/^Component returned failure code: 0x8000ffff \(NS_ERROR_UNEXPECTED\) \[nsIPrefBranch2?.get(?:(?:Int|Bool|Char)Pref|ComplexValue)\]$/.test(exception.message)) {
        // Don't display messages about prefs unless uncaught
        return undefined;
      }
      this.file.writeString(exception.message + "\n");
      for each (let frame in exception.frames) {
        this.file.writeString("\t" + frame + "\n");
      }
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

/***** nsIConosoleListener *****/
Logophile.prototype.observeMessage = function Logophile_observeMessage(aMessage) {
  try {
    let nsIScriptError = Ci.nsIScriptError2 || Ci.nsIScriptError;
    aMessage instanceof Ci.nsIScriptError;
    aMessage instanceof nsIScriptError;
    let tags = aMessage.category.split(/\s+/g) || [];
    switch (true) {
      case !!(aMessage.flags & Ci.nsIScriptError.exceptionFlag):
        tags.push("EXCEPTION"); break;
      case !!(aMessage.flags & Ci.nsIScriptError.errorFlag):
        tags.push("ERROR"); break;
      case !!(aMessage.flags & Ci.nsIScriptError.warningFlag):
        tags.push("WARNING"); break;
      case !!(aMessage.flags & Ci.nsIScriptError.strictFlag):
        tags.push("STRICT"); break;
    }
    if (tags.length > 0) {
      this.file.writeString("[" + tags.join(" ") + "]: ");
    }
    let message = aMessage instanceof Ci.nsIScriptError ?
                  aMessage.errorMessage :
                  aMessage.message;
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
      for (let frame = Components.stack; frame; frame = frame.caller) {
        if (frame.filename == Components.stack.filename) {
          continue; // Skip frames from Logophile
        }
        this.file.writeString("\t" + frame + "\n");
      }
    }
  } catch (ex) {
    dump(ex);
    /* don't infinite loop, thanks */
  }
};

/***** nsIConsoleService *****/
Logophile.prototype.logMessage = function Logophile_logMessage(aMessage) {
  this._consoleService.logMessage(aMessage);
  this.observeMessage(aMessage);
}
Logophile.prototype.logStringMessage = function Logophile_logStringMessage(aMessage) {
  this._consoleService.logStringMessage(aMessage);
}
Logophile.prototype.getMessageArray = function Logophile_getMessageArray(aMessages, aCount) {
  this._consoleService.getMessageArray(aMessages, aCount);
}
Logophile.prototype.registerListener = function Logophile_registerListener(aListener) {
  this._consoleService.registerListener(aListener);
}
Logophile.prototype.unregisterListener = function Logophile_unregisterListener(aListener) {
  this._consoleService.unregisterListener(aListener);
}
Logophile.prototype.reset = function Logophile_reset() {
  this._consoleService.reset();
}

/***** nsISupports *****/

Logophile.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.nsIObserver,
                         Ci.jsdIExecutionHook,
                         Ci.jsdIActivationCallback,
                         Ci.nsIConsoleService]);

Logophile.prototype.classID =
  Components.ID("{a95116d1-a818-44ac-a865-04165b166e7e}");

const NSGetFactory = XPCOMUtils.generateNSGetFactory([Logophile]);

try {
  Logophile.prototype._consoleService =
    Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

  Cm.QueryInterface(Ci.nsIComponentRegistrar)
    .unregisterFactory(Components.ID(Cc["@mozilla.org/consoleservice;1"].number),
                       Cm.getClassObjectByContractID("@mozilla.org/consoleservice;1",
                                                     Ci.nsIFactory));

  Cm.registerFactory(Components.ID("{db5f4dd0-9610-453c-a90f-6168ce2bb85e}"),
                     "LogophileConsoleService",
                     "@mozilla.org/consoleservice;1",
                     NSGetFactory(Logophile.prototype.classID));
} catch (ex) {
  dump(ex);
}
