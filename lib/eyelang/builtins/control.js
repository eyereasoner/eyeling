// Control builtins.  These intentionally use bounded nested solvers so not/1 and once/1 only ask for the answers they need.
export const controlBuiltins = {
  register(registry) {
    registry.add('not', 1, notBuiltin);
    registry.add('once', 1, onceBuiltin);
  }
};

function* notBuiltin({ solver, goal, env }) {
  const limited = solver.cloneForInnerGoal(1);
  let found = false;
  for (const _ of limited.solve([goal.args[0]], env.clone(), 0)) { found = true; break; }
  if (!found) yield env;
}

function* onceBuiltin({ solver, goal, env }) {
  const limited = solver.cloneForInnerGoal(1);
  for (const answerEnv of limited.solve([goal.args[0]], env.clone(), 0)) {
    yield answerEnv;
    break;
  }
}
