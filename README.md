INTRODUCTION
============
This is a quick hack to log error console messages to a file.  All messages will
be logged to "logophile.log" in your profile directory.  It does its best to
figure out the stack, but this may be incorrect at times.  Unfortunately Gecko
doesn't really allow anything better.

KNOWN PROBLEMS
==============
This will cause hard crashes (actually, `abort`s) when an error comes from a
non-main thread.  This was enough to get me the messages I cared about, so there
is currently no attempt to fix this.  (It will probably require rewriting in C++
instead of JavaScript, and thus require a compilation step.)
