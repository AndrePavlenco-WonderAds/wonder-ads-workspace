#!/usr/bin/env python3
"""Corta os retratos da equipa para `public/team/avatar/` (usados na lista da
equipa do inquérito NPS).

Porque é que isto é um script e não um corte à mão: as fotos são de estúdio,
cada pessoa está a uma distância diferente da câmara, e um corte "a olho" dava
uma lista onde cada cara aparece a um tamanho diferente. Aqui o enquadramento é
uma REGRA — cabeça a 40% da altura da caixa, 10% de folga por cima, retrato 3:4
— e o que muda por pessoa são só três números medidos na foto original.

Como adicionar/substituir alguém:
  1. põe a foto original em ~/Desktop/WonderAds/Company Related/EQUIPA/
  2. mede na foto (em píxeis da original): topo do cabelo, queixo e o centro
     horizontal da cara
  3. acrescenta/atualiza a linha em PEOPLE e corre `python3 scripts/crop-team-avatars.py`

Requer Pillow (`python3 -m pip install --user Pillow`).
"""

from pathlib import Path

from PIL import Image

SRC = Path.home() / "Desktop/WonderAds/Company Related/EQUIPA"
OUT = Path(__file__).resolve().parent.parent / "public/team/avatar"

OUT_W, OUT_H = 300, 400  # 3:4 — o mesmo rácio da caixa no formulário
HEAD_FRAC = 0.40  # altura da cabeça / altura da caixa -> sobra tronco
HEADROOM = 0.10  # folga acima do cabelo, em frações da altura da caixa

# (ficheiro de saída, ficheiro original, topo do cabelo, queixo, centro x da cara)
PEOPLE = [
    ("fran-r", "FranRosa.png", 156, 494, 533),
    ("joao-b", "JoaoBatista.jpeg", 65, 439, 369),
    ("andre-pereira", "AndrePereira.png", 215, 605, 500),
    ("andre", "AndrePavlenco.png", 152, 492, 532),
    ("vasco-m", "VascoMonte.png", 123, 492, 543),
    ("mike", "MikeNobre.png", 123, 471, 543),
    ("renan", "Renan.png", 123, 514, 543),
    ("alex", "AlexPavlenco.png", 138, 456, 585),
    ("alice", "AliceSantos.png", 130, 463, 565),
    ("cylas", "CylasTee.png", 130, 492, 554),
    ("tiago-s", "TiagoSilveira.png", 145, 521, 554),
    ("gustavo", "Gustavo.png", 109, 492, 548),
]


def crop(name: str, filename: str, hair_top: int, chin: int, face_cx: int) -> None:
    im = Image.open(SRC / filename).convert("RGB")
    W, H = im.size
    head = chin - hair_top

    box_h = min(head / HEAD_FRAC, H)
    box_w = box_h * 0.75
    if box_w > W:  # foto original demasiado estreita para o 3:4 pedido
        box_w, box_h = W, W / 0.75

    top = max(0.0, min(hair_top - HEADROOM * box_h, H - box_h))
    left = max(0.0, min(face_cx - box_w / 2, W - box_w))

    (
        im.crop((round(left), round(top), round(left + box_w), round(top + box_h)))
        .resize((OUT_W, OUT_H), Image.LANCZOS)
        .save(OUT / f"{name}.jpg", quality=86, optimize=True, progressive=True)
    )
    print(f"{name:14s} {round(box_w)}x{round(box_h)} @ {round(left)},{round(top)}")


def square_to_portrait(name: str) -> None:
    """Passa a 3:4 um retrato antigo do site, que é quadrado.

    Sem foto de estúdio não há tronco para mostrar: corta-se pelos lados. Fica
    mais apertado que os outros, mas é a única forma sem artefactos — esticar o
    fundo por baixo deixava uma mancha desfocada bem visível na lista. Remendo
    até a pessoa posar. Não faz nada se o ficheiro já estiver em 3:4, para
    poder correr-se o script à vontade.
    """
    original = Image.open(OUT / f"{name}.jpg").convert("RGB")
    if original.width != original.height:
        return
    W, H = original.size
    box_w = round(H * 0.75)
    left = (W - box_w) // 2
    original.crop((left, 0, left + box_w, H)).resize((OUT_W, OUT_H), Image.LANCZOS).save(
        OUT / f"{name}.jpg", quality=86, optimize=True, progressive=True
    )
    print(f"{name:14s} quadrado antigo cortado pelos lados até 3:4")


if __name__ == "__main__":
    for row in PEOPLE:
        crop(*row)
    # Germano Cunha ainda não tem foto de estúdio; só o retrato quadrado do site.
    square_to_portrait("germano-c")
