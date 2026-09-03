/** Scryer/Trealla-compatible module facade for EyeProlog's native dif/2. */

:- module(dif, [dif/2]).

% dif/2 is supplied by the normal EyeProlog registry. Keeping this module
% clause-free preserves that implementation while allowing the canonical
% explicit import used by library(reif) and portable source.
