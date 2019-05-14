import { Graph } from "graphlib";
import dot = require("graphlib-dot");
import { map, zipWith } from "ramda";
import {
    AtomicExp, IfExp, Parsed, VarDecl, isAtomicExp, DefineExp, AppExp, ProcExp,
    isAppExp, isDefineExp, isIfExp, isProcExp, parse, unparse, isPrimOp, isLitExp, LitExp, isLetExp, LetExp, isProgram, Program, Binding} from "./L4-ast";
import { safeF, isError } from "./error";
import { SExp, isEmptySExp, isCompoundSExp, CompoundSExp, isSymbolSExp, SymbolSExp, valueToString } from "./L4-value";

const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

interface Tree {
    tag: "Tree",
    rootId: string,
    graph: Graph,
}

export const isTree = (x: any): x is Tree => x.tag === "Tree";

const makeLeaf = (label: string): Tree => {
    let graph = new Graph();
    const headId = generateId();
    graph.setNode(headId, { label, shape: "record" });
    return { tag: "Tree", rootId: headId, graph };
}


const makeTree = (label: string, nodes: Tree[], edgesLabels: string[]): Tree => {
    let graph = new Graph();
    const headId = generateId();
    graph.setNode(headId, { label, shape: "record" });
    zipWith(
        (t, edgeLabel) => {
            map(n => graph.setNode(n, t.graph.node(n)), t.graph.nodes());
            map(e => graph.setEdge(e.v, e.w, t.graph.edge(e)), t.graph.edges());
            graph.setEdge(headId, t.rootId, { label: edgeLabel });
        },
        nodes,
        edgesLabels
    )
    return { tag: "Tree", rootId: headId, graph };
}

const astToDot = (ast: Tree): string => dot.write(ast.graph);

const expToTree = (exp: string) =>
    safeF(astToDot)(safeF(makeAST)(parse(exp)));

export const makeAST = (exp: Parsed): Tree | Error =>
    isError(exp) ? exp : makeASTnoErrors(exp);

const makeGenTree = (exp: Parsed | VarDecl | Binding | CompoundSExp | SymbolSExp | Parsed[] | VarDecl[] | Binding[]): ((nodes: Tree[]) => Tree) =>
    exp instanceof Array ? (nodes) => makeTree(":", nodes, Object.keys(exp)) :
        (nodes) => makeTree(exp.tag, nodes, Object.keys(exp).slice(1));

const makeASTnoErrors = (exp: Parsed): Tree =>
    isLitExp(exp) ? handleLit(exp) :
        isLetExp(exp) ? handleLet(exp) :
            isProgram(exp) ? handleProg(exp) :
                isIfExp(exp) ? handleIf(exp) :
                    isProcExp(exp) ? handleProc(exp) :
                        isDefineExp(exp) ? handleDefine(exp) :
                            isAtomicExp(exp) ? handleAtomic(exp) :
                                isAppExp(exp) ? handleApp(exp) :
                                    null;

const handleLit = (exp: LitExp): Tree =>
    makeGenTree(exp)([handleS(exp.val)])

const handleS = (exp: SExp): Tree =>
    isEmptySExp(exp) ? makeLeaf(exp.tag) :
        isCompoundSExp(exp) ? makeGenTree(exp)([handleS(exp.val1), handleS(exp.val2)]) :
                isSymbolSExp(exp) ? makeGenTree(exp)([handleS(exp.val)]) :
                    makeLeaf(valueToString(exp))

const handleLet = (exp: LetExp): Tree =>
    makeGenTree(exp)([handleBindingArray(exp.bindings), handleArray(exp.body)])

const handleProg = (exp: Program): Tree =>
    makeGenTree(exp)([handleArray(exp.exps)])

const handleProc = (exp: ProcExp): Tree =>
    makeGenTree(exp)([handleVarDeclArray(exp.args), handleArray(exp.body)])

const handleIf = (exp: IfExp): Tree =>
    makeGenTree(exp)([makeASTnoErrors(exp.test), makeASTnoErrors(exp.then), makeASTnoErrors(exp.alt)])

const handleDefine = (exp: DefineExp): Tree =>
    makeGenTree(exp)([handleVarDecl(exp.var), makeASTnoErrors(exp.val)])

const handleVarDecl = (exp: VarDecl): Tree =>
    makeGenTree(exp)([makeLeaf(exp.var)])

const handleApp = (exp: AppExp): Tree =>
    makeGenTree(exp)([makeASTnoErrors(exp.rator), handleArray(exp.rands)])

const handleBinding = (exp: Binding): Tree =>
    makeGenTree(exp)([handleVarDecl(exp.var), makeASTnoErrors(exp.val)])

const handleBindingArray = (exp: Binding[]): Tree =>
    makeGenTree(exp)(map(handleBinding, exp))

const handleVarDeclArray = (exp: VarDecl[]): Tree =>
    makeGenTree(exp)(map(handleVarDecl, exp))

const handleArray = (exp: Parsed[]): Tree =>
    makeGenTree(exp)(map(makeASTnoErrors, exp));

const handleAtomic = (exp: AtomicExp): Tree =>
isPrimOp(exp) && (exp.op === ">" || exp.op === "<") ?
    makeGenTree(exp)([makeLeaf("\\" + unparse(exp))]) :
        makeGenTree(exp)([makeLeaf(unparse(exp))])

// Tests. Please uncomment
const p1 = "(define x 4)";
console.log(expToTree(p1));

const p2 = "(define y (+ x 4))";
console.log(expToTree(p2));

const p3 = "(if #t (+ x 4) 6)";
console.log(expToTree(p3));

const p4 = "(lambda (x y) x)";
console.log(expToTree(p4));

const curry: <T1,T2,T3> (f:(x:T1 ,y:T2) => T3) => 
((a:T1)=>((b:T2)=>T3))= (f)=>((a)=>((b)=>f(a,b)));