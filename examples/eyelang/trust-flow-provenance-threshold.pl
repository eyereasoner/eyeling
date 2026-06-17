% Provenance-derived trust-flow thresholding in eyelang.

materialize(confidence, 2).
materialize(trust_flow_state, 2).
materialize(status, 2).
materialize(risk, 2).

message(message_a, publisher_a, transform_a, signature_a, receiver_app).
message(message_b, publisher_b, transform_b, signature_b, receiver_app).

publisher_trust(publisher_a, 0.95).
publisher_trust(publisher_b, 0.70).
signature_strength(signature_a, 0.98).
signature_strength(signature_b, 0.75).
quality_score(transform_a, 0.96).
quality_score(transform_b, 0.80).
acceptance_threshold(receiver_app, 0.85).

confidence(Message, Confidence) :-
  message(Message, Publisher, Transform, Signature, _Receiver),
  publisher_trust(Publisher, PublisherTrust),
  signature_strength(Signature, SignatureTrust),
  quality_score(Transform, Quality),
  mul(PublisherTrust, SignatureTrust, A),
  mul(A, Quality, Confidence).

trust_flow_state(Message, fpv_accepted) :-
  message(Message, _Publisher, _Transform, _Signature, Receiver),
  confidence(Message, Confidence),
  acceptance_threshold(Receiver, Threshold),
  ge(Confidence, Threshold).

trust_flow_state(Message, fpv_quarantine) :-
  message(Message, _Publisher, _Transform, _Signature, Receiver),
  confidence(Message, Confidence),
  acceptance_threshold(Receiver, Threshold),
  lt(Confidence, Threshold).

status(Message, fpv_high_trust_flow) :- trust_flow_state(Message, fpv_accepted).
risk(Message, risk_low_trust_data_source) :- trust_flow_state(Message, fpv_quarantine).
