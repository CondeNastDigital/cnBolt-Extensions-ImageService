<?php
namespace Bolt\Extension\CND\ImageService\Connector;

interface IConnector
{
    /* ---------------- Constants for service identification ----------------
    const ID = "cloudinary";
    const TITLE = "Cloudinary";
    const ICON = "http://res.cloudinary.com/cloudinary/image/upload/new_cloudinary_logo_square.png";
    const LINK = "http://www.cloudinary.com";
    */

    const FORMAT_JPG = "jpg";
    const FORMAT_PNG = "png";
    const FORMAT_GIF = "gif";
    const FORMAT_ICO = "ico";

    const MODE_SCALE = "scale"; // Resize exactly to the given width and height without retaining aspect ratio.
    const MODE_LIMIT = "limit"; // Resize inside given width and height and retain aspect ratio. Only if original is larger than target!
    const MODE_FILL  = "fill";  // Resize exactly to the given width and height and retain aspect ratio, cropping the image if necessary.
    const MODE_FIT   = "fit";   // Resize inside given width and height and retain aspect ratio.
    const MODE_PAD   = "pad";   // Resize exactly to the given width and height and retain aspect ratio, padding the image if necessary.

    /**
     * Generate the image url for an image
     * @param string $mediaKey  image key
     * @param int $width        width in pixel
     * @param int $height       height in pixel
     * @param string $mode      mode for resizing/cropping
     * @param string $format    output format (jpg, png, etc...)
     * @param int $quality      compression quality in percent
     * @param array $options    custom options
     * @return string mixed
     */
    public function imageUrl($mediaKey, $width, $height, $mode, $format, $quality, $options);

    /**
     * Upload a new image and store it's meta data. Return the image key or false
     * @param string $filepath
     * @param array $attributes
     * @return string|bool
     */
    public function imageUpload($filepath, $attributes);

    /**
     * Update the attributes of a stored image
     * @param string $imageKey
     * @param array $attributes
     * @return bool
     */
    public function imageUpdate($imageKey, $attributes);

    /**
     * Delete an image from the service
     * @param $imageKey
     * @return bool
     */
    public function imageDelete($imageKey);

    /**
     * Search an image inside the service
     * @param $search
     * @return array     an array with the imageKey and an array of attributes
     */
    public function imageSearch($search);

    // --- Supported Features

    /**
     * Return an array of all supported resizing mode constants.
     * @return array
     */
    public function supportedModes();

    /**
     * Return an array of all supported image format constants.
     * @return array
     */
    public function supportedFormats();

    // --- External service urls

    /**
     * generate the url to open the service's image editor
     * @return string|false
     */
    public function adminImage($imageKey);

    /**
     * generate the url to the service's admin interface
     * @return string|false
     */
    public function adminGlobal();

}