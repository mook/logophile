const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr, manager: Cm } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function Logophile() {
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

Logophile.prototype.observe = function Logophile_observe(aSubject, aTopic, aData) {
  /* nothing */
};

Logophile.prototype.observeMessage = function Logophile_observeMessage(aMessage) {
  try {
    let nsIScriptError = Ci.nsIScriptError2 ? Ci.nsIScriptError2 : Ci.nsIScriptError;
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
    if (tags) {
      this.file.writeString("[" + tags.join(" ") + "]: ");
    }
    this.file.writeString((aMessage.errorMessage || aMessage.message) + "\n");

    if (aMessage instanceof Ci.nsIScriptError) {
      this.file.writeString("\t" + aMessage.sourceName +
                            (aMessage.lineNumber ? "@" + aMessage.lineNumber : "") +
                            (aMessage.columnNumber ? ":" + aMessage.columnNumber : "") +
                            "\n");
    }

    for (let frame = Components.stack; frame; frame = frame.caller) {
      if (frame.filename == Components.stack.filename) {
        continue; // Skip frames from Logophile
      }
      this.file.writeString("\t" + frame + "\n");
    }
  } catch (ex) {
    dump(ex);
    /* don't infinite loop, thanks */
  }
};

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

Logophile.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsIConsoleService]);

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
