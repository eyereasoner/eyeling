% Parse unstructured service logs with named regex captures, then reason over
% the extracted context to correlate events that share a trace id.
materialize(parsed_event, 5).
materialize(captured_field, 3).
materialize(trace_alert, 3).

log_pattern("^ts=(?<ts>\\S+) level=(?<level>\\w+) event=(?<event>\\w+) user=(?<user>\\w+) ip=(?<ip>\\S+) traceparent=00-(?<trace_id>[0-9a-f]{32})-(?<span_id>[0-9a-f]{16})-(?<flags>[0-9a-f]{2})$").

raw_log(l1, "ts=2026-06-18T10:00:00Z level=warn event=login_failed user=alice ip=203.0.113.9 traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01").
raw_log(l2, "ts=2026-06-18T10:00:03Z level=error event=payment_denied user=alice ip=203.0.113.9 traceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-aaf067aa0ba90000-01").
raw_log(l3, "ts=2026-06-18T10:01:12Z level=info event=login_success user=bob ip=198.51.100.4 traceparent=00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01").
raw_log(noise, "healthcheck ok").

parsed(Log, Context) :-
  raw_log(Log, Text),
  log_pattern(Pattern),
  matches(Text, Pattern, Context).

% holds/3 lets one generic rule project every named capture as field data.
captured_field(Log, Name, Value) :-
  parsed(Log, Context),
  holds(Context, Name, [Value]).

parsed_event(Log, Event, User, Ip, TraceId) :-
  parsed(Log, Context),
  holds(Context, event(Event)),
  holds(Context, user(User)),
  holds(Context, ip(Ip)),
  holds(Context, trace_id(TraceId)).

trace_alert(User, TraceId, Ip) :-
  parsed_event(LoginLog, "login_failed", User, Ip, TraceId),
  parsed_event(PaymentLog, "payment_denied", User, Ip, TraceId),
  neq(LoginLog, PaymentLog).
