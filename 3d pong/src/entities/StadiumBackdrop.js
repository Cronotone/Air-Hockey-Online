import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

export function createStadiumBackdrop() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(85, 80),
    new THREE.MeshStandardMaterial({
      color: 0x121b25,
      roughness: 0.92,
      metalness: 0.02,
    })
  );
  floor.rotation.x = -Math.PI * 0.5;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  group.add(floor);

  const standGeometry = new THREE.BoxGeometry(4.6, 2.4, 2.1);
  const standMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d2c3d,
    roughness: 0.75,
    metalness: 0.08,
  });

  const sections = 32;
  const radius = 29;
  for (let i = 0; i < sections; i += 1) {
    const angle = (i / sections) * Math.PI * 2;
    const stand = new THREE.Mesh(standGeometry, standMaterial);
    stand.position.set(Math.cos(angle) * radius, 1.2 + ((i % 3) * 0.26), Math.sin(angle) * radius);
    stand.lookAt(0, 0.5, 0);
    stand.castShadow = true;
    stand.receiveShadow = true;
    group.add(stand);
  }

  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(34, 0.1, 14, 100),
    new THREE.MeshBasicMaterial({
      color: 0x58a5ff,
      transparent: true,
      opacity: 0.72,
    })
  );
  ringLight.rotation.x = Math.PI * 0.5;
  ringLight.position.y = 0.22;
  group.add(ringLight);

  return group;
}
