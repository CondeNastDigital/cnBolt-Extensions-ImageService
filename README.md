# cnBolt-Extensions-ImageService
Use image services as replacement for Bolt's image fields.
The service uses different connectors to local or cloud services.

A connector for Cloudinary is already included.

There are no other connectors available at the moment.

## Installation

1.) Edit your extensions/composer.json file and add the **cnd-imageservice** repository:
```
    "repositories": {
        "packagist": false,
        "bolt": {
            "type": "composer",
            "url": "https://extensions.bolt.cm/satis/"
        },
        "cnd-imageservice": {
            "type": "git",
            "url": "https://github.com/CondeNastDigital/cnBolt-Extensions-ImageService.git"
        }
    },
```
2.) Change to the extensions folder and install via composer.
```
php app/nut extensions:install

If the nut command is not located in the app folder, you could also find it in vendor/bin/nut.

```
Installing or updating via the Bolt admin interface is also possible but would require the web-server's user to have proper access to the GitHup repository. This is usually not the case.

## Configuration

Add the following field to your content type, where you want to add the extension. E.g. in pages:

```
pages:
    name: Pages
    singular_name: Page
    fields:
        imageservice:
            type: imageservicelist
            label: CouldImage
            attributes:
                title:
                    type: text
                    label: Image Title
                alt:
                    type: text
                    label: Alternative Text
                caption:
                    type: textarea
                    label: Caption
```

## Usage
Within your twig template, you may access the content type field which comes in form of an JSON string.
There is a custom twig filter, which converts the JSON string into an array. Here is an example, how to fetch the content elements within a twig template:
```
{% set images = record.imageupload|json_decode %}

{% for image in images.items %}
    {% setcontent currentElement = image %}
    {{ dump(currentElement) }}
{% endfor %}
```
There is also a custom twig filter, that gives back the image url in different sizes:

```
{% set images = record.imageupload|json_decode %}

{% for image in images.items %}
    {{ dump(imageservice(image,150,100)) }}
    {{ dump(imageservice(image,250,150)) }}
{% endfor %}
```

# Vendor libraries
The folder vendor contains libraries from various image services. These folders are not managed by any automatism like composer and need to be updated manually.

