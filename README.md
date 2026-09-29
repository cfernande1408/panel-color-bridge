# Panel Color Bridge

La barra superior de GNOME toma el color de la ventana activa:
Firefox en tiempo real (junto con Adaptive Tab Bar Colour) y el
resto de apps con colores fijos. Sin ventana activa, la barra vuelve
a su estilo normal (compatible con Blur my Shell).

## Piezas

- `gnome/`: extensión de GNOME Shell (probada en GNOME 50).
- `firefox/`: extensión de Firefox que envía el color del tema.
- `host/`: puente de native messaging entre Firefox y GNOME.

## Instalación

    ./install.sh

Cierra sesión y vuelve a entrar, y después:

    gnome-extensions enable panel-color@carlos

Instala en Firefox la extensión firmada (`.xpi`).
