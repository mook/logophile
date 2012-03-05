const EXPORTED_SYMBOLS = ["PrefProxy"];

const { classes: Cc, interfaces: Ci } = Components;

function PrefProxy(aRoot) {
  function createBranch(aParent, aName) {
    let branch = Cc["@mozilla.org/preferences-service;1"]
                   .getService(Ci.nsIPrefService)
                   .getBranch(aParent.root + aName);
    let proxy = Proxy.create({
      getOwnPropertyDescriptor: function Logophile_prefs_getOwnPropertyDescriptor(aName) {
        if (!(aName in Object.getOwnPropertyNames.call(proxy))) {
          return undefined;
        }
        let type = branch.getPrefType(aName);
        if (type == Ci.nsIPrefbranch.PREF_INVALID) {
          // assume sub branch
          return createBranch(proxy, aName + ".");
        }
        let get, set;
        switch (branch.getPrefType(aName)) {
          case Ci.nsIPrefBranch.PREF_INVALID:
            // assume sub branch
            return createBranch(proxy, aName + ".");
          case Ci.nsIPrefBranch.PREF_STRING:
            [get, set] = ["getCharPref", "setCharPref"];
            break;
          case Ci.nsIPrefBranch.PREF_INT:
            [get, set] = ["getIntPref", "setIntPref"];
            break
          case Ci.nsIPrefBranch.PREF_BOOL:
            [get, set] = ["getBoolPref", "setBoolPref"];
            break;
        }
        return {
          configurable: true,
          enumerable: true,
          get: function _prefGet() branch[get](aName),
          set: function _prefSet(val) branch[set](aName, val),
        };
      },
      getPropertyDescriptor: function Logophile_prefs_getPropertyDescriptor(aName) {
        for (let proto = proxy; proto !== null; proto = Object.getPrototypeOf(proto)) {
          let descriptor = Object.getOwnPropertyDescriptor.call(proto, aName);
          if (descriptor !== undefined)
            return descriptor;
        }
        return undefined;
      },
      getOwnPropertyNames: function Logophile_prefs_getOwnPropertyNames() {
        let names = {};
        for each (let name in branch.getChildList("")) {
          names[name.replace(/\..*/, "")] = true;
        }
        return Object.keys(names).sort();
      },
      getPropertyNames: function Logophile_prefs_getPropertyNames() {
        let names = {};
        for (let proto = proxy; proto !== null; proto = Object.getPrototypeOf(proto))
          for each (let name in Object.getOwnPropertyNames.call(proto))
            names[name] = true;
        return Object.keys(names).sort();
      },
      defineProperty: function Logophile_prefs_defineProperty(aName, aDescriptor) {
        
      },
      delete: function Logophile_prefs_delete(aName) {
        if (branch.getPrefType(aName) == Ci.nsIPrefBranch.PREF_INVALID)
          return false;
        try {
          branch.clearUserPref(aName);
        } catch (ex) {
          return false;
        }
        return true;
      },
      fix: function Logophile_prefs_fix() undefined,
      set: function Logophile_prefs_set(aReceiver, aName, aVal) {
        let val = ("get" in aDescriptor) ? aDescriptor.get() : aDescriptor.value;
        if (val === !!val) {
          branch.setBoolPref(aName, !!val);
        } else if ((Number(val) >> 0) === val) {
          branch.setIntPref(aName, !!val);
        } else {
          branch.setCharPref(aName, val);
        }
      },
    });
    return proxy;
  }
  return createBranch({root: ""}, aRoot);
});