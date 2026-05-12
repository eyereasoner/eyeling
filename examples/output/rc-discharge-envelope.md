# rc-discharge-envelope  

## Answer  
exact decay symbol : exp(-1/4)  
certified decay interval : [0.7788007830, 0.7788007831]  
first below tolerance step : 13  
first below tolerance time : 0.325 s  
upper voltage at step 13 : 0.930581 V  

## Explanation  
The physical decay factor is exp(-1/4), but the example uses a finite double interval as the certificate. Because the interval lies strictly between 0 and 1, the capacitor voltage envelope contracts each sample. The upper envelope is the safety-relevant bound: once it falls below 1.0 V, every compatible exact trajectory is below tolerance.  
