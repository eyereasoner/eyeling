# matrix-mechanics  

## Source files  

- [N3 rules](../matrix-mechanics.n3)  

## Answer  
In this toy matrix-mechanics model, the Hamiltonian has two discrete energy levels and does not commute with a second observable.  

## Reason Why  
H = [[1,0],[0,2]]  
X = [[0,1],[1,0]]  
HX = [[0,1],[2,0]]  
XH = [[0,2],[1,0]]  
[H,X] = [[0,-1],[1,0]]  

## Check  
trace/determinant match energy levels: yes  
X^2 = I : yes  
[H,X] != 0 : yes  
