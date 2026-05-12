# eco-route-insight  

## Answer  
insight status : issue  
show eco banner : yes  
audience : Depot X  
allowed use : ui.eco.banner  
suggested route : alt-low-fuel  
current fuel index : 120.75  
suggested fuel index : 99.75  
estimated saving : 21.00  
expires at : 2025-01-01T11:00:00Z  
raw data exported : no  
signature algorithm : HMAC-SHA256  
payload digest : 00e19becd91e81d6881749655d23d43002d9ea714bba61e855eafbc8ef9a5135  
signature key : local-demo-key  
signature : 7fFGBN8fyI7xrmRz5VreeAUSf3LC_ywbj32NGk2ovUs  

## Explanation  
The current route uses fuel index = distanceKm × (payloadKg / 1000) × gradientFactor. For shipment-1, Current urban route gives 42.00 × 2.50 × 1.15 = 120.75. The policy threshold is 120.00, so a local eco banner is justified. The selected alternative alt-low-fuel gives 38.00 × 2.50 × 1.05 = 99.75, saving 21.00 while staying within the ETA delay limit. The signed envelope exposes audience, use, expiry, route suggestion, and compact fuel indices, but not raw payload, GPS trace, driver behavior, or raw telemetry.  
