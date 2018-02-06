# cnBolt-Extensions-ImageService
Use image services as replacement for Bolt's image fields.
The service uses different connectors to local or cloud services.

A connector for Cloudinary is already included.

There are no other connectors available at the moment.

## Installation

1.) Install via composer or bolt's marketplace.
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
    
        # Standalone ImageService field
        imageservice:
            type: imageservicelist
            label: CouldImage
            attributes: &ImageServiceAttributes
                title:
                    type: text
                    label: Image Title
                alt:
                    type: text
                    label: Alternative Text
                caption:
                    # Type textarea includes a simple HTML edit prugin called Scribe
                    type: textarea 
                    label: Caption
                chgeckbox:
                    type: checkbox
                    label: checkbox
                    value: 1
                    
        # Image Service as a part of Bolt-Structured-Content (SirTrevor)
        structuredcontent:
            type: structuredcontentfield
            height: 400px
            blocks: [Imageservice, Heading, Text, List, Video, Quote]
            extend:  #block_config
                imageService:
                    maxFiles: 1
                    maxFileSize: 20000
                    attributes: 
                        <<: *ImageServiceAttributes
```

Change the configuration file for this extension (created after instalation and first call to bolt) 
in app/config/extensions/imageservice.cnd.yml

```
# A list of all active image services with their class names and config variables

security: &security
    allowed-extensions: [jpeg, jpg, JPG, png, gif]
    max-size: 5000000

connectors:

    # A sample config for a local content connector that stores images in a bolt contenttype
    content:
        class: Bolt\Extension\CND\ImageService\Connector\ContentConnector
        contentype: images
        cache: 1        # number of seconds or false for never cached
        delete: true    # if true, content object of the image will be deleted. If not, status will only be changed to "held"
        path: "imageservice/%year%/%month%" # Taregt folder for uploaded files. Defaults to "%year%/%month%". Allowed placeholders are %year%, %month%
        security: *security
        tagtype: tags   # Use this taxonomy for tags
        
    # a sample config for cloudinary that stores all images in cloudinary    
    cloudinary:
        class: Bolt\Extension\CND\ImageService\Connector\CloudinaryConnector
        cloud-name:           my-cloud
        api-key:              12345678901234567890
        api-secret:           myapisecretinmyfabulouscloud
        api-base-url:         https://api.cloudinary.com/v1_1/my-cloud
        base-delivery-url:    https://res.cloudinary.com/my-cloud
        secure-delivery-url:  https://res.cloudinary.com/my-cloud
        security: *security
        upload-defaults:
            unique_filename: true
            overwrite: false
            folder: false
            type: upload
            image_metadata: false
            colors: false
            invalidate: true        

defaults:
    connector: content
    image:
        mode:     limit
        format:   jpg
        quality:  80
        options:  []

permissions:
    roles:
        edit: [editor, chief-editor, developer]
        view: [everyone]

```

## Usage
Within your twig template, you may access the imageservice field which comes as an array of image objects.
You can then render ech image of this array either via the `imageservice` filter or with bolt's 
own `thumbnail` filter (which is overridden by this extension).

```
{# take the first image from the field (you could also loop through all of them if you want a gallery #}

{% set image = record.teaserimage.items|first %}
<img src="{{ image|thumbnail(370,210,'c','',65) }}">
```

## Filters
The extension provides a imageservice filter. You can also simply keep using the `thumbnail` filter, which 
is overridden by this extension.
Normal images of Bolt's native image field will still be redirected to the original `thumbnail` filter.

**imageservice**
The filter supports these parameters:
- $width - Desired widths of the image in pixel
- $height - Desired height of the image in pixel
- $mode - Desired cropping mode of the image. Available: scale, fill, pad, limit, fit
- $format - Desired image format. Default: jpg
- $quality - Desired image quality
- $options - array of additional options as supported by your used connector

```
<img src="{{ image|imageservice(370,210,'limit','jpg',65,{something: else}) }}">
```

## Crop modes
The connectors should support these crop modes:
- scale - Resize exactly to the given width and height without retaining aspect ratio.
- limit - Resize inside given width and height and retain aspect ratio. Only if original is larger than target!
- fill - Resize exactly to the given width and height and retain aspect ratio, cropping the image if necessary.
- fit - Resize inside given width and height and retain aspect ratio.
- pad - Resize exactly to the given width and height and retain aspect ratio, padding the image if necessary.

# Vendor libraries
The folder vendor contains libraries from various image services like Cloudinary. These folders are not 
managed by any automatism like composer and need to be updated manually.

# Tech Notes

The extension makes a copy of the save button, in order to make sure that, that images will be saved 
as a first thing on saving. If the event needs to be cancelled, e.g. by problem on saving, the saving of the
article must be abandoned as well. No better way found to deal with the events.

If the field is needed as a single file upload, one should set the maxFiles property on 1. 
The forntend does not allow the creation on new Images of different service types. That is why the 
 images of different services can only be managed in separate fields.
 
 The ImageServiceField type is surrently untested and possibly unmaintained. We suggest to use the 
 ImageServiceListField with maxFiles set to 1.