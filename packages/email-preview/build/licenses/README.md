# Retained dependency licenses

`ufo-1.6.4.txt` is the complete, unchanged `LICENSE` from the installed npm package
`ufo@1.6.4` (`https://registry.npmjs.org/ufo/-/ufo-1.6.4.tgz`), maintained at
<https://github.com/unjs/ufo>. Its copyright is held by Pooya Parsa.

Nitro `3.0.260903-beta` includes a reduced `ufo@1.6.4` package under
`dist/node_modules/ufo` without that license, and Nitro's compressed third-party
notices do not include ufo. The build collector uses this exact text only when
the bundled package identity is `ufo@1.6.4` and its license is absent. A different
version fails the build until its provenance and license are checked.

The final archive includes the text in `dist/THIRD_PARTY_LICENSES.txt`.
