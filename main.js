const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

// --- Камера "вид сверху" ---
const camera = new BABYLON.ArcRotateCamera(
    "camera",
    0,           // Поворот вокруг оси Y
    1.3,         // Наклон (около 1.57 = строго сверху)
    15,          // Радиус (расстояние до центра)
    new BABYLON.Vector3(0, 0, 0),
    scene
);
camera.attachControl(canvas, true);

// --- Свет ---
const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

// --- Плоскость (земля) ---
BABYLON.SceneLoader.ImportMesh("", "models/", "playground.glb", scene, function (newMeshes) {
    if (!newMeshes || newMeshes.length === 0) return;

    const playground = newMeshes[0].parent || newMeshes[0];

    // Устанавливаем нулевую позицию, если нужно подогнать
    playground.position = new BABYLON.Vector3(0, 0, 0);
    playground.rotationQuaternion = null; // Убираем поворот, если он был в glTF

    // Масштабирование (если слишком большая/маленькая)
    playground.scaling = new BABYLON.Vector3(1, 1, 1);
});

// --- Цены элементов ---
const elementPrices = {
    "swing.glb": 5000,
    "lgk_314.glb": 10000,
    "msk_201.glb": 15000,
    "bench.glb": 3000,
    "msk_105.glb": 4000,
    "lgk_11.glb": 6000,
    "lgp_112.glb": 7000,
    "lgd_3.glb": 11000,
};

let totalPrice = 0;

// --- Словарь стандартных размеров для моделей ---
// Здесь можно задавать требуемый размер (максимальная размерность) для каждой модели.
const modelSizes = {
    "swing.glb": 1,
    "lgk_314.glb": 2,
    "msk_201.glb": 3,
    "bench.glb": 2,       // Например, для скамейки
    "msk_105.glb": 1.5,
    "lgk_11.glb": 1.2,
    "lgp_112.glb": 2.5,
    "lgd_3.glb": 3,
};

// --- Обработчик начала перетаскивания для загрузки модели ---
document.querySelectorAll(".item").forEach(item => {
    item.addEventListener("dragstart", event => {
        const model = event.target.closest(".item").getAttribute("data-model");
        console.log("Drag started:", model);
        event.dataTransfer.setData("model", model);
    });
});

// --- Остановка поведения по умолчанию для drop ---
canvas.addEventListener("dragover", event => event.preventDefault());

// --- Обработка события drop для загрузки модели ---
canvas.addEventListener("drop", event => {
    event.preventDefault();
    const modelName = event.dataTransfer.getData("model");
    const pickResult = scene.pick(event.clientX, event.clientY);

    if (modelName) {
        BABYLON.SceneLoader.ImportMesh("", "models/", modelName, scene, function (newMeshes) {
            if (!newMeshes || newMeshes.length === 0) {
                console.error("Ошибка: модель не загружена", modelName);
                return;
            }

            // Создаем контейнер (TransformNode) для импортированных мешей
            const container = new BABYLON.TransformNode("modelContainer", scene);
            newMeshes.forEach(mesh => {
                mesh.parent = container;
            });

            // При необходимости поворачиваем конкретные модели
            if (modelName === "bench.glb") {
                container.rotation.x = Math.PI / 2;
            }

            // Ставим контейнер в точку броска (или (0,0,0), если pickResult не сработал)
            container.position = pickResult.pickedPoint || new BABYLON.Vector3(0, 0, 0);

            // Вычисляем bounding box
            let boundingVectors = container.getHierarchyBoundingVectors();
            let size = boundingVectors.max.subtract(boundingVectors.min);
            let maxDimension = Math.max(size.x, size.y, size.z);

            // Определяем стандартный размер для модели из словаря
            // Если для модели не задан размер, используется значение по умолчанию (1)
            let standardSize = modelSizes[modelName] || 1;

            // Вычисляем коэффициент масштабирования так, чтобы максимальная размерность модели стала равна standardSize
            let scaleFactor = standardSize / maxDimension;
            container.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);

            // После масштабирования заново вычисляем bounding box и выравниваем нижнюю грань по Y=0
            boundingVectors = container.getHierarchyBoundingVectors();
            const minY = boundingVectors.min.y;
            container.position.y -= minY;

            // Добавляем цену
            const price = elementPrices[modelName] || 0;
            totalPrice += price;
            document.getElementById("totalPrice").textContent = totalPrice.toLocaleString();

            // Добавляем информацию в таблицу с кнопкой удаления
            const tableBody = document.querySelector("#elementsTable tbody");
            const row = document.createElement("tr");
            row.innerHTML = `<td>${modelName}</td>
                             <td>${price.toLocaleString()} ₽</td>
                             <td><button class="delete-button" style="cursor:pointer;">🗑️</button></td>`;
            tableBody.appendChild(row);

            // Сохраняем ссылку на контейнер и стоимость в строке
            row.container = container;
            row.price = price;

            // Обработчик удаления элемента по клику на кнопку
            row.querySelector(".delete-button").addEventListener("click", () => {
                if (row.container) {
                    row.container.dispose();
                }
                totalPrice -= row.price;
                document.getElementById("totalPrice").textContent = totalPrice.toLocaleString();
                row.remove();
            });
        });
    }
});

// --- Очистка всех элементов (кроме земли) ---
document.getElementById("clearButton").addEventListener("click", () => {
    totalPrice = 0;
    document.getElementById("totalPrice").textContent = "0";
    document.querySelector("#elementsTable tbody").innerHTML = "";

    scene.meshes.forEach(mesh => {
        if (mesh !== ground) {
            mesh.dispose();
        }
    });

    scene.transformNodes.forEach(node => {
        if (node.name === "modelContainer") {
            node.dispose();
        }
    });
});

// Отключаем стандартное контекстное меню (правый клик)
canvas.addEventListener("contextmenu", event => event.preventDefault());

// --- Глобальные переменные для управления манипуляциями с объектами ---
let selectedMesh = null;
let isDragging = false;
let isRotating = false;
let dragOffset = BABYLON.Vector3.Zero();
let initialRotationY = 0;
let initialPointerX = 0;

// Обрабатываем клики и движение мыши
scene.onPointerObservable.add(pointerInfo => {
    const event = pointerInfo.event;
    
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const pickInfo = pointerInfo.pickInfo;
        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
            // Если клик по земле – не выбираем объект
            if (pickInfo.pickedMesh === ground) {
                selectedMesh = null;
                return;
            }
            // Иначе выбираем корневой контейнер
            selectedMesh = pickInfo.pickedMesh.parent || pickInfo.pickedMesh;

            // Отключаем управление камерой, чтобы не мешалось при перемещении/вращении
            camera.detachControl(canvas);

            // Левый клик (button=0) – начинаем перетаскивание
            if (event.button === 0) {
                isDragging = true;
                // Смещение между точкой клика и центром объекта
                dragOffset = selectedMesh.position.subtract(pickInfo.pickedPoint);

            // Правый клик (button=2) – начинаем вращение
            } else if (event.button === 2) {
                isRotating = true;
                initialRotationY = selectedMesh.rotation.y;
                initialPointerX = event.clientX;
            }
        }
    }
    else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        // Перемещение
        if (isDragging && selectedMesh) {
            // Пикаем по земле, чтобы получить координаты
            const pickResult = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === ground);
            if (pickResult && pickResult.hit && pickResult.pickedPoint) {
                let newPos = pickResult.pickedPoint.add(dragOffset);
                // Фиксируем объект «на земле» (Y=0)
                newPos.y = 0;
                selectedMesh.position = newPos;

                // Чтобы не проваливался при движении, ещё раз выравниваем нижнюю грань:
                let boundingVectors = selectedMesh.getHierarchyBoundingVectors();
                const minY = boundingVectors.min.y;
                selectedMesh.position.y -= minY;
            }
        }
        // Вращение
        else if (isRotating && selectedMesh) {
            const deltaX = event.clientX - initialPointerX;
            selectedMesh.rotation.y = initialRotationY + deltaX * 0.01;
        }
    }
    else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
        // Завершаем перемещение/вращение
        if (isDragging || isRotating) {
            camera.attachControl(canvas, true); // возвращаем управление камерой
        }
        isDragging = false;
        isRotating = false;
        selectedMesh = null;
    }
});

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
