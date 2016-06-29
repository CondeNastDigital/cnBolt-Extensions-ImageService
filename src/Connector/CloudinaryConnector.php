<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Bolt\Application;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Menu\MenuEntry;

require_once __DIR__."/../../vendor/cloudinary/Cloudinary.php";
require_once __DIR__."/../../vendor/cloudinary/Api.php";
use Cloudinary;
use Cloudinary\Api;

class CloudinaryConnector implements IConnector
{
    const ID = "cloudinary";
    const TITLE = "Cloudinary";
    const ICON = "http://res.cloudinary.com/cloudinary/image/upload/new_cloudinary_logo_square.png";
    const LINK = "http://www.cloudinary.com";

    /* @var Cloudinary $cloudinary */
    protected $Cloudinary;

    /* @var Application $container */
    protected $container = null;

    /* @var array $config */
    protected $config = [];

    /**
     * @inheritdoc
     */
    public function __construct(Application $app, $config){
        $this->config = $config;
        $this->container = $app;

        Cloudinary::config([
            "cloud_name" => $this->config["cloud-name"],
            "api_key"    => $this->config["api-key"],
            "api_secret" => $this->config["api-secret"]
        ]);
    }

    /**
     * @inheritdoc
     */
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options)
    {
        $mode_map = [
            self::MODE_SCALE => "c_scale",
            self::MODE_FILL => "c_fill",
            self::MODE_PAD => "c_pad",
            self::MODE_LIMIT => "c_limit",
            self::MODE_FIT => "c_fit",
        ];

        // Base URL
        $url = $this->config["base-delivery-url"]."/image/upload/";

        // Apply modifiers
        $modifiers = [];
        if($mode && isset($mode_map[$mode])) // Resize mpode
            $modifiers[] = $mode_map[$mode];
        if((int)$width)                      // Width
            $modifiers[] = "w_".(int)$width;
        if((int)$height)                     // Height
            $modifiers[] = "h_".(int)$height;
        $url .= $modifiers ? implode(",",$modifiers)."/" : "";

        // Image
        $url .= $image->id.".";

        // Format
        $url .= $format && in_array($format, $this->supportedFormats()) ? $format : "jpg";

        return $url;
    }

    /**
     * @inheritdoc
     */
    public function imageProcess(array $images)
    {
        // TODO: Implement imageUpload() method.
    }

    /**
     * @inheritdoc
     */
    public function imageSearch($search)
    {
        $api = new Api();

        /* @var Cloudinary\Api\Response $result */

        // Search by id
        $resultId = $api->resources([
            "type" => "upload",
            "resource_type" => "image",
            "prefix" => $search,
            "max_results" => 10,
            "tags" => true,
            "context" => true
        ]);

        // Search by tag
        $resultTag = $api->resources_by_tag($search, [
            "type" => "upload",
            "resource_type" => "image",
            "max_results" => 10,
            "tags" => true,
            "context" => true
        ]);

        // Merge both search results into one
        $results = array_merge($resultId["resources"], $resultTag["resources"]);

        // Convert cloudinary resource items to image items
        $images = [];
        foreach($results as $item){
            $image = new Image($item["public_id"], self::ID);

            $image->attributes = isset($item["context"]["custom"]) ? $item["context"]["custom"] : [];
            $image->tags = isset($item["tags"]) ? $item["tags"] : [];

            $image->info = [
                Image::INFO_HEIGHT => $item["height"],
                Image::INFO_WIDTH => $item["width"],
                Image::INFO_SIZE => $item["bytes"],
                Image::INFO_FORMAT => $item["format"],
                Image::INFO_SOURCE => $item["url"],
                Image::INFO_CREATED => $item["created_at"]
            ];

            $images[$item["public_id"]] = $image;
        }

        return $images;
    }

    /**
     * @inheritdoc
     */
    public function tagSearch($search){
        $api = new Api();

        $result = $api->tags([
            "prefix" => $search
        ]);

        return $result["tags"];
    }

    /**
     * @inheritdoc
     */
    public function supportedModes()
    {
        return [
            self::MODE_FILL,
            self::MODE_FIT,
            self::MODE_LIMIT,
            self::MODE_PAD,
            self::MODE_SCALE
        ];
    }

    /**
     * @inheritdoc
     */
    public function supportedFormats()
    {
        return [
            self::FORMAT_GIF,
            self::FORMAT_ICO,
            self::FORMAT_JPG,
            self::FORMAT_PNG
        ];
    }

    /**
     * @inheritdoc
     */
    public function adminImage($imageKey)
    {
        // TODO: Implement adminImage() method.
    }

    /**
     * @inheritdoc
     */
    public function adminGlobal()
    {
        $medialibrary = new MenuEntry('cloudinary-admin-ui', '//cloudinary.com/console/media_library');
        $medialibrary->setLabel("Cloudinary Media")
            ->setIcon('fa:cloud')
            ->setPermission('editor');

        return [ $medialibrary ];
    }
}