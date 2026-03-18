```merfolk
%% foldspace Repository Analysis

%% Components
AppLoader{Component: AppLoader}
CustomCamera{Component: CustomCamera}
Scene{Component: Scene}
CustomEnvironment{Component: CustomEnvironment}
LoadingMessage{Component: LoadingMessage}
App{Component: App}
EconomyBar{Component: EconomyBar}
PlaneMesh{Component: PlaneMesh}
CellLoader{Component: CellLoader}
Ship{Component: Ship}
Loader{Component: Loader}
SphereRenderer{Component: SphereRenderer}
SphereGroup{Component: SphereGroup}
Sphere{Component: Sphere}
UserPanel{Component: UserPanel}

%% Internal Helper Components
Scene -.-> CustomEnvironment : "internal"

%% Functions
calculateDistance[Function: calculateDistance]
updateCells[Function: updateCells]
processLoadingQueue[Function: processLoadingQueue]
ScoutShip[Function: ScoutShip]
ColonyShip[Function: ColonyShip]

%% Hooks
useCells[Function: useCells]
useLoadingQueue[Function: useLoadingQueue]
useBVH[Function: useBVH]
useAuth[Function: useAuth]
useFilteredPositions[Function: useFilteredPositions]
useSpherePools[Function: useSpherePools]
useUpdateGeometry[Function: useUpdateGeometry]
useClearDetailedSpheres[Function: useClearDetailedSpheres]

%% Services
cache[Function: cache]
readCellDataFile[Function: readCellDataFile]
writeCellDataFile[Function: writeCellDataFile]
deleteDocumentsInBatches[Function: deleteDocumentsInBatches]
addBuildingToQueue[Function: addBuildingToQueue]
processConstructionQueue[Function: processConstructionQueue]
updateShipPositions[Function: updateShipPositions]
addShipToQueue[Function: addShipToQueue]
processShipConstructionQueue[Function: processShipConstructionQueue]

%% Stores
useStore[[Store: useStore]]

%% Utilities
validateToken[Function: validateToken]
createMouseHandlers[Function: createMouseHandlers]
onMouseDown[Function: onMouseDown]
onMouseUp[Function: onMouseUp]
updateGeometry[Function: updateGeometry]
CustomShaderMaterial_js[Function: CustomShaderMaterial_js]
atmosGlow_js[Function: atmosGlow_js]
planetShader_jsx[Function: planetShader_jsx]
clearPositionsByDistance[Function: clearPositionsByDistance]
ringShader_js[Function: ringShader_js]
sunShader_js[Function: sunShader_js]
getCachedGeometry[Function: getCachedGeometry]
getCachedShader[Function: getCachedShader]
ensureVector3[Function: ensureVector3]
createVector3Array[Function: createVector3Array]
serializeVector3Array[Function: serializeVector3Array]
fetchCellDataInBatches[Function: fetchCellDataInBatches]
generateNewPositions[Function: generateNewPositions]
calculateRandomOrbitPosition[Function: calculateRandomOrbitPosition]
generateRandomPositions[Function: generateRandomPositions]
positions[Function: positions]
saveCellData[Function: saveCellData]
BVHNode[Function: BVHNode]
BVH[Function: BVH]
buildBVH[Function: buildBVH]
queryBVH[Function: queryBVH]
nextPowerOf2[Function: nextPowerOf2]
createTextTexture[Function: createTextTexture]
systemShader_jsx[Function: systemShader_jsx]
deserializeVector3Array[Function: deserializeVector3Array]
updatePositions[Function: updatePositions]
worker[Function: worker]
pendingRequests[Function: pendingRequests]
generateRequestId[Function: generateRequestId]
loadCell[Function: loadCell]
newSet[Function: newSet]
updatedLoadedCells[Function: updatedLoadedCells]
SpherePool[Function: SpherePool]
createInstancedMesh[Function: createInstancedMesh]
disposeMaterial[Function: disposeMaterial]
disposeGeometry[Function: disposeGeometry]
unloadCell[Function: unloadCell]
newLoadedCells[Function: newLoadedCells]

%% External Libraries
react<Library: react>
@react-three/fiber<Library: @react-three/fiber>
@react-three/drei<Library: @react-three/drei>
firebase/firestore<Library: firebase/firestore>
three<Library: three>
lodash<Library: lodash>
firebase/app<Library: firebase/app>
firebase/auth<Library: firebase/auth>
react-dom/client<Library: react-dom/client>
zustand<Library: zustand>
vite<Library: vite>
@vitejs/plugin-react<Library: @vitejs/plugin-react>

%% Component Internal Functions
customcameraMemoizedCameraPosition[Function: customcameraMemoizedCameraPosition]
customcameraMemoizedLookAt[Function: customcameraMemoizedLookAt]
sceneLoadCellCallback[Function: sceneLoadCellCallback]
sceneUnloadCellCallback[Function: sceneUnloadCellCallback]
sceneFlattenedPositions[Function: sceneFlattenedPositions]
sceneUpdateShipPosition[Function: sceneUpdateShipPosition]
appFetchUserEconomy[Function: appFetchUserEconomy]
appFetchAllShipsData[Function: appFetchAllShipsData]
appFetchOwnedPlanets[Function: appFetchOwnedPlanets]
appAssignGreenSphere[Function: appAssignGreenSphere]
appUpdateShipDestination[Function: appUpdateShipDestination]
planemeshUpdateShipDestination[Function: planemeshUpdateShipDestination]
planemeshCalculateCellKey[Function: planemeshCalculateCellKey]
cellloaderCheckCellsAroundCamera[Function: cellloaderCheckCellsAroundCamera]
cellloaderThrottledCheckCellsAroundCamera[Function: cellloaderThrottledCheckCellsAroundCamera]
shipLineMaterial[Function: shipLineMaterial]
sphererendererMemoizedSphereMaterials[Function: sphererendererMemoizedSphereMaterials]
sphererendererMemoizedDetailedPositions[Function: sphererendererMemoizedDetailedPositions]
sphererendererMemoizedLessDetailedPositions[Function: sphererendererMemoizedLessDetailedPositions]
sphererendererAnimate[Function: sphererendererAnimate]
spheregroupMemoizedPositions[Function: spheregroupMemoizedPositions]
spheregroupMemoizedMoonPositions[Function: spheregroupMemoizedMoonPositions]
sphereMemoizedSphere[Function: sphereMemoizedSphere]
userpanelMoveCameraToPlanet[Function: userpanelMoveCameraToPlanet]
userpanelToggleShipsList[Function: userpanelToggleShipsList]
userpanelTogglePlanetOptions[Function: userpanelTogglePlanetOptions]
userpanelToggleDropdown[Function: userpanelToggleDropdown]
userpanelToggleBuildButton[Function: userpanelToggleBuildButton]
userpanelGetShipsInConstruction[Function: userpanelGetShipsInConstruction]
userpanelGetBuildingsInConstruction[Function: userpanelGetBuildingsInConstruction]

%% Component-Function Relationships
CustomCamera -.-> customcameraMemoizedCameraPosition : "internal function"
CustomCamera -.-> customcameraMemoizedLookAt : "internal function"
Scene -.-> sceneLoadCellCallback : "internal function"
Scene -.-> sceneUnloadCellCallback : "internal function"
Scene -.-> sceneFlattenedPositions : "internal function"
Scene -.-> sceneUpdateShipPosition : "update helper"
App -.-> appFetchUserEconomy : "internal function"
App -.-> appFetchAllShipsData : "internal function"
App -.-> appFetchOwnedPlanets : "internal function"
App -.-> appAssignGreenSphere : "internal function"
App -.-> appUpdateShipDestination : "update helper"
PlaneMesh -.-> planemeshUpdateShipDestination : "update helper"
PlaneMesh -.-> planemeshCalculateCellKey : "calculation helper"
CellLoader -.-> cellloaderCheckCellsAroundCamera : "internal function"
CellLoader -.-> cellloaderThrottledCheckCellsAroundCamera : "internal function"
Ship -.-> shipLineMaterial : "internal function"
SphereRenderer -.-> sphererendererMemoizedSphereMaterials : "render helper"
SphereRenderer -.-> sphererendererMemoizedDetailedPositions : "render helper"
SphereRenderer -.-> sphererendererMemoizedLessDetailedPositions : "render helper"
SphereRenderer -.-> sphererendererAnimate : "render helper"
SphereGroup -.-> spheregroupMemoizedPositions : "internal function"
SphereGroup -.-> spheregroupMemoizedMoonPositions : "internal function"
Sphere -.-> sphereMemoizedSphere : "internal function"
UserPanel -.-> userpanelMoveCameraToPlanet : "internal function"
UserPanel -.-> userpanelToggleShipsList : "boolean check"
UserPanel -.-> userpanelTogglePlanetOptions : "internal function"
UserPanel -.-> userpanelToggleDropdown : "internal function"
UserPanel -.-> userpanelToggleBuildButton : "internal function"
UserPanel -.-> userpanelGetShipsInConstruction : "getter function"
UserPanel -.-> userpanelGetBuildingsInConstruction : "getter function"

%% File Container Nodes
useBVH_file[Hook: useBVH]
useAuth_file[Hook: useAuth]
hooks[Hook: hooks]
mouseEvents[Hook: mouseEvents]
useUpdateGeometry_file[Hook: useUpdateGeometry]
shader_shaders[Function: shaders]
useClearDetailedSpheres_file[Hook: useClearDetailedSpheres]
resourceCache[Function: resourceCache]
store[[Store: store]]
cellWorker[Function: cellWorker]
BVH_file[Function: BVH]
textTexture[Function: textTexture]
loadCell_file[Function: loadCell]
SpherePool_file[Function: SpherePool]
backend_index((Service: index))
utils[Function: utils]
unloadCell_file[Function: unloadCell]
backend_buildingManagement((Service: buildingManagement))
backend_shipMovement((Service: shipMovement))
backend_shipManagement((Service: shipManagement))

%% File-Function Relationships
useBVH_file -.-> useBVH : "contains"
useAuth_file -.-> useAuth : "contains"
useAuth_file -.-> validateToken : "contains"
hooks -.-> useFilteredPositions : "contains"
hooks -.-> useSpherePools : "contains"
mouseEvents -.-> createMouseHandlers : "contains"
mouseEvents -.-> onMouseDown : "contains"
mouseEvents -.-> onMouseUp : "contains"
useUpdateGeometry_file -.-> useUpdateGeometry : "contains"
useUpdateGeometry_file -.-> updateGeometry : "contains"
shader_shaders -.-> CustomShaderMaterial_js : "contains"
shader_shaders -.-> atmosGlow_js : "contains"
shader_shaders -.-> planetShader_jsx : "contains"
shader_shaders -.-> ringShader_js : "contains"
shader_shaders -.-> sunShader_js : "contains"
shader_shaders -.-> systemShader_jsx : "contains"
useClearDetailedSpheres_file -.-> useClearDetailedSpheres : "contains"
useClearDetailedSpheres_file -.-> clearPositionsByDistance : "contains"
resourceCache -.-> getCachedGeometry : "contains"
resourceCache -.-> getCachedShader : "contains"
store -.-> ensureVector3 : "contains"
cellWorker -.-> createVector3Array : "contains"
cellWorker -.-> serializeVector3Array : "contains"
cellWorker -.-> fetchCellDataInBatches : "contains"
cellWorker -.-> generateNewPositions : "contains"
cellWorker -.-> calculateRandomOrbitPosition : "contains"
cellWorker -.-> generateRandomPositions : "contains"
cellWorker -.-> positions : "contains"
cellWorker -.-> saveCellData : "contains"
BVH_file -.-> BVHNode : "contains"
BVH_file -.-> BVH : "contains"
BVH_file -.-> buildBVH : "contains"
BVH_file -.-> queryBVH : "contains"
textTexture -.-> nextPowerOf2 : "contains"
textTexture -.-> createTextTexture : "contains"
loadCell_file -.-> deserializeVector3Array : "contains"
loadCell_file -.-> createVector3Array : "contains"
loadCell_file -.-> updatePositions : "contains"
loadCell_file -.-> worker : "contains"
loadCell_file -.-> pendingRequests : "contains"
loadCell_file -.-> generateRequestId : "contains"
loadCell_file -.-> loadCell : "contains"
loadCell_file -.-> newSet : "contains"
loadCell_file -.-> updatedLoadedCells : "contains"
SpherePool_file -.-> SpherePool : "contains"
backend_index -.-> cache : "contains"
backend_index -.-> readCellDataFile : "contains"
backend_index -.-> writeCellDataFile : "contains"
backend_index -.-> deleteDocumentsInBatches : "contains"
utils -.-> createInstancedMesh : "contains"
unloadCell_file -.-> disposeMaterial : "contains"
unloadCell_file -.-> disposeGeometry : "contains"
unloadCell_file -.-> unloadCell : "contains"
unloadCell_file -.-> newLoadedCells : "contains"
backend_buildingManagement -.-> addBuildingToQueue : "contains"
backend_buildingManagement -.-> processConstructionQueue : "contains"
backend_shipMovement -.-> updateShipPositions : "contains"
backend_shipManagement -.-> addShipToQueue : "contains"
backend_shipManagement -.-> processShipConstructionQueue : "contains"

%% Component Relationships
Scene --> Loader : "uses"
Scene --> SphereRenderer : "cameraRef, flattenedPositions, redPositions..."
Scene --> Scene : "uses"
Scene --> CustomEnvironment : "receives"
Scene --> CustomCamera : "camera"
Scene --> CellLoader : "cameraRef, loadCell, unloadCell"
Scene --> Ship : "shipKey, shipInfo, handleShipClick..."
App --> UserPanel : "user, ownedPlanets, shipsData..."
App --> EconomyBar : "economy"
App --> Scene : "backgroundColor, cameraRef, sphereRendererRef..."
App --> LoadingMessage : "message"
SphereRenderer --> PlaneMesh : "sphereRefs, lessDetailedMeshRef, instancedMeshRef..."
SphereRenderer --> SphereGroup : "color, positions, moonPositions..."

%% Component Dependencies
CustomCamera --> useStore : "uses store"
Scene --> useStore : "uses store"
Scene --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
Scene --> loadCell_file : "uses utility"
loadCell_file --> loadCell : "receives"
Scene --> unloadCell_file : "uses utility"
unloadCell_file --> unloadCell : "receives"
Scene --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
Scene --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
CustomEnvironment --> Scene : "calls out"
Scene --> useStore : "uses store"
CustomEnvironment --> Scene : "calls out"
Scene --> useAuth_file : "uses hook"
useAuth_file --> useAuth_file : "receives"
CustomEnvironment --> Scene : "calls out"
Scene --> loadCell_file : "uses utility"
loadCell_file --> loadCell : "receives"
CustomEnvironment --> Scene : "calls out"
Scene --> unloadCell_file : "uses utility"
unloadCell_file --> unloadCell : "receives"
App --> useStore : "uses store"
App --> useAuth_file : "{isAuthenticated, isLoading, user}"
useAuth_file --> useAuth_file : "receives"
App --> useAuth_file : "{isAuthenticated, isLoading, user}"
useAuth_file --> useAuth_file : "receives"
PlaneMesh --> useStore : "uses store"
PlaneMesh --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
PlaneMesh --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
CellLoader --> useStore : "uses store"
CellLoader --> BVH_file : "uses utility"
BVH_file --> buildBVH : "receives"
CellLoader --> BVH_file : "uses utility"
BVH_file --> queryBVH : "receives"
CellLoader --> useCells : "{cells, bvhRootRef, updateCells}"
CellLoader --> useLoadingQueue : "{loadingQueue, dispatch, processLoadingQueue}"
Ship --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
Ship --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
Ship --> useAuth_file : "{user}"
useAuth_file --> useAuth_file : "receives"
SphereRenderer --> useStore : "uses store"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useSpherePools : "receives"
SphereRenderer --> useBVH_file : "uses hook"
useBVH_file --> useBVH_file : "receives"
SphereRenderer --> useUpdateGeometry_file : "{detailedPositions, lessDetailedPositions}"
useUpdateGeometry_file --> useUpdateGeometry_file : "receives"
SphereRenderer --> useClearDetailedSpheres_file : "uses hook"
useClearDetailedSpheres_file --> useClearDetailedSpheres_file : "receives"
SphereRenderer --> resourceCache : "uses utility"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "uses utility"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useSpherePools : "receives"
SphereRenderer --> useBVH_file : "uses hook"
useBVH_file --> useBVH_file : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> hooks : "uses hook"
hooks --> useFilteredPositions : "receives"
SphereRenderer --> useClearDetailedSpheres_file : "uses hook"
useClearDetailedSpheres_file --> useClearDetailedSpheres_file : "receives"
SphereRenderer --> useUpdateGeometry_file : "{detailedPositions, lessDetailedPositions}"
useUpdateGeometry_file --> useUpdateGeometry_file : "receives"
SphereGroup --> resourceCache : "uses utility"
resourceCache --> getCachedGeometry : "receives"
Sphere --> textTexture : "uses utility"
textTexture --> createTextTexture : "receives"
UserPanel --> useStore : "uses store"

%% Function Call Relationships
Scene --> loadCell_file : "calls loadCell"
loadCell_file --> loadCell : "receives"
Scene --> loadCell_file : "calls loadCell"
loadCell_file --> loadCell : "receives"
Scene --> unloadCell_file : "calls unloadCell"
unloadCell_file --> unloadCell : "receives"
Scene --> unloadCell_file : "calls unloadCell"
unloadCell_file --> unloadCell : "receives"
Scene --> loadCell_file : "calls loadCell"
loadCell_file --> loadCell : "receives"
Scene --> loadCell_file : "calls loadCell"
loadCell_file --> loadCell : "receives"
Scene --> unloadCell_file : "calls unloadCell"
unloadCell_file --> unloadCell : "receives"
Scene --> unloadCell_file : "calls unloadCell"
unloadCell_file --> unloadCell : "receives"
PlaneMesh --> useStore : ".getState()"
PlaneMesh --> useStore : ".getState()"
CellLoader --> BVH_file : "calls queryBVH"
BVH_file --> queryBVH : "receives"
CellLoader --> BVH_file : "calls queryBVH"
BVH_file --> queryBVH : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> useStore : ".setState()"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedShader"
resourceCache --> getCachedShader : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereRenderer --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
SphereGroup --> resourceCache : "calls getCachedGeometry"
resourceCache --> getCachedGeometry : "receives"
Sphere --> textTexture : "calls createTextTexture"
textTexture --> createTextTexture : "receives"
```
