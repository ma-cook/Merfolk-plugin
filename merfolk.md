```merfolk
%% Merfolk-plugin Repository Analysis

%% Functions
activate[Function: activate]
deactivate[Function: deactivate]
traverseVanillaAST[Function: traverseVanillaAST]
traverseReactAST[Function: traverseReactAST]
traversePythonSource[Function: traversePythonSource]
traverseVueSource[Function: traverseVueSource]
addToSet[Function: addToSet]
addToFileContainer[Function: addToFileContainer]
classifyName[Function: classifyName]
processVanillaNode[Function: processVanillaNode]
getInternalFunctionLabel[Function: getInternalFunctionLabel]
walkNodeForJSX[Function: walkNodeForJSX]
deepWalkForCallSites[Function: deepWalkForCallSites]
analyzeComponentBody[Function: analyzeComponentBody]
processReactDecl[Function: processReactDecl]
classifyPython[Function: classifyPython]
parseJS[Function: parseJS]
analyzeFile[Function: analyzeFile]
containsJSX[Function: containsJSX]
generateMerfolkMarkdown[Function: generateMerfolkMarkdown]
computeContainerNodeId[Function: computeContainerNodeId]
formatProps[Function: formatProps]
detectRepoType[Function: detectRepoType]
walkDir[Function: walkDir]
fileExists[Function: fileExists]
readPackageJson[Function: readPackageJson]
getDeps[Function: getDeps]
getProdDeps[Function: getProdDeps]
scanWorkspace[Function: scanWorkspace]
getFileType[Function: getFileType]
sanitizeNodeId[Function: sanitizeNodeId]

%% External Libraries
vscode<Library: vscode>
path<Library: path>
fs<Library: fs>
@babel/parser<Library: @babel/parser>
fs/promises<Library: fs/promises>
vitest/config<Library: vitest/config>

%% File Container Nodes
extension.d[Function: extension.d]
extension[Function: extension]
astTraversal.d[Function: astTraversal.d]
astTraversal[Function: astTraversal]
fileAnalyzer.d[Function: fileAnalyzer.d]
fileAnalyzer[Function: fileAnalyzer]
merfolkGenerator.d[Function: merfolkGenerator.d]
merfolkGenerator[Function: merfolkGenerator]
repoTypeDetector.d[Function: repoTypeDetector.d]
repoTypeDetector[Function: repoTypeDetector]
workspaceScanner.d[Function: workspaceScanner.d]
workspaceScanner[Function: workspaceScanner]
utils.d[Function: utils.d]
utils[Function: utils]

%% File-Function Relationships
extension.d -.-> activate : "contains"
extension.d -.-> deactivate : "contains"
extension -.-> activate : "contains"
extension -.-> deactivate : "contains"
astTraversal.d -.-> traverseVanillaAST : "contains"
astTraversal.d -.-> traverseReactAST : "contains"
astTraversal.d -.-> traversePythonSource : "contains"
astTraversal.d -.-> traverseVueSource : "contains"
astTraversal -.-> addToSet : "contains"
astTraversal -.-> addToFileContainer : "contains"
astTraversal -.-> classifyName : "contains"
astTraversal -.-> processVanillaNode : "contains"
astTraversal -.-> traverseVanillaAST : "contains"
astTraversal -.-> getInternalFunctionLabel : "contains"
astTraversal -.-> walkNodeForJSX : "contains"
astTraversal -.-> deepWalkForCallSites : "contains"
astTraversal -.-> analyzeComponentBody : "contains"
astTraversal -.-> processReactDecl : "contains"
astTraversal -.-> traverseReactAST : "contains"
astTraversal -.-> classifyPython : "contains"
astTraversal -.-> traversePythonSource : "contains"
astTraversal -.-> parseJS : "contains"
astTraversal -.-> traverseVueSource : "contains"
fileAnalyzer.d -.-> analyzeFile : "contains"
fileAnalyzer.d -.-> containsJSX : "contains"
fileAnalyzer -.-> analyzeFile : "contains"
fileAnalyzer -.-> containsJSX : "contains"
merfolkGenerator.d -.-> generateMerfolkMarkdown : "contains"
merfolkGenerator -.-> computeContainerNodeId : "contains"
merfolkGenerator -.-> formatProps : "contains"
merfolkGenerator -.-> generateMerfolkMarkdown : "contains"
repoTypeDetector.d -.-> detectRepoType : "contains"
repoTypeDetector -.-> walkDir : "contains"
repoTypeDetector -.-> fileExists : "contains"
repoTypeDetector -.-> readPackageJson : "contains"
repoTypeDetector -.-> getDeps : "contains"
repoTypeDetector -.-> getProdDeps : "contains"
repoTypeDetector -.-> detectRepoType : "contains"
workspaceScanner.d -.-> scanWorkspace : "contains"
workspaceScanner -.-> getFileType : "contains"
workspaceScanner -.-> scanWorkspace : "contains"
utils.d -.-> sanitizeNodeId : "contains"
utils -.-> sanitizeNodeId : "contains"

```