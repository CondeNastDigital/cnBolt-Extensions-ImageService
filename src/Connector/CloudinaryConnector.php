<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Bolt\Application;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Extension\CND\ImageService\IConnector;
use Bolt\Menu\MenuEntry;
use Sirius\Upload\Handler as UploadHandler;
use Sirius\Upload\Result\File;

require_once __DIR__."/../../vendor/cloudinary/Cloudinary.php";
require_once __DIR__."/../../vendor/cloudinary/Api.php";
require_once __DIR__."/../../vendor/cloudinary/Uploader.php";

use Cloudinary;
use Cloudinary\Api;
use Cloudinary\Uploader;

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
    public function imageProcess(array $images, &$messages = [])
    {
        $create = [];
        $update = [];
        $delete = [];
        $clean = [];

        foreach($images as $key => $image){
            switch($image->status){
                case Image::STATUS_DELETED:
                    $delete[$key] = $image;
                    break;
                case Image::STATUS_DIRTY:
                    $update[$key] = $image;
                    break;
                case Image::STATUS_NEW:
                    $create[$key] = $image;
                    break;
                case Image::STATUS_CLEAN:
                    $clean[$key] = $image;
                    break;
                default:
                    $clean[$key] = $image;
                    $messages[] = [
                        "type" => IConnector::RESULT_TYPE_ERROR,
                        "code" => IConnector::RESULT_CODE_ERRSTATUS,
                        "id" => $image->id
                    ];
            }
        }

        // Send grouped commands
        if($delete)
            $delete = $this->processDelete($delete, $messages);
        if($update)
            $update = $this->processUpdate($update, $messages);
        if($create)
            $create = $this->processCreate($create, $messages);

        // Merges the results in the clean instance
        $clean = $update + $create + $clean;
        // Reorders the key to match the initial key order
        ksort($clean);

        return $clean;
    }

    /**
     * Delete all ids in array
     * @param Image[] $images
     * @param array $messages
     * @return \Bolt\Extension\CND\ImageService\Image[]
     */
    protected function processDelete(array $images, &$messages = []){
        // Collect ids
        $ids = [];
        foreach($images as $image)
            $ids[] = $image->id;

        // Process deletion request
        $api = new Api();
        $result = $api->delete_resources($ids, [
            "all" => true
        ]);

        // Update status
        foreach($images as $idx => $image) {
            if (isset($result["deleted"][$image->id]) && $result["deleted"][$image->id] == "deleted")
                unset($images[$idx]);
            else
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRUNKNOWN,
                    "id" => $image->id
                ];
        }

        return $images;
    }

    /**
     * Delete all ids in array
     * NOTE: Cloudinary
     * @param Image[] $images
     * @param array $messages
     * @return \Bolt\Extension\CND\ImageService\Image[]
     */
    protected function processUpdate(array $images, &$messages = []){

        $api = new Api();

        foreach($images as $idx => $image){
            $result = $api->update($image->id, [
                "tags" => $image->tags,
                "context" => $image->attributes
            ]);

            //var_dump($result); // TODO: returning result not in docs? Dump and refactor when known

            $image->status = Image::STATUS_CLEAN;
        }

        return $images;
    }

    /**
     * Delete all ids in array
     * NOTE: Cloudinary
     * @param Image[] $images
     * @param array $messages
     * @return \Bolt\Extension\CND\ImageService\Image[]
     */
    protected function processCreate(array $images, &$messages = []){

        foreach($images as $idx => &$image){
            // Check if a file was posted
            if(!isset($_FILES[$image->id])){
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRNOFILE,
                    "id" => $image->id
                ];
                continue;
            }

            $filesource = $_FILES[$image->id]["tmp_name"];
            $filename   = $_FILES[$image->id]["name"];
            $size       = $_FILES[$image->id]["size"];
            $fileinfo   = pathinfo($filename);
            $ext        = $fileinfo["extension"];

            // Validation Config
            $allowedExtensions = $this->config['security']['allowed-extensions'];
            $allowedMaxSize    = $this->config['security']['max-size'];

            // Simple Validation of the uploaded images
            if(!is_readable($filesource)) {               // file doesnt exist or permissions wrong
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEINVALID,
                    "id" => $image->id
                ];
                continue;
            }

            if($size > $allowedMaxSize){                    // file size is to large
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILESIZE,
                    "id" => $image->id
                ];
                continue;
            }

            if(!in_array($ext, $allowedExtensions) ||        // extension is not allowed
               !in_array($ext, self::supportedFormats())) {  // extension is not supported
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEEXT,
                    "id" => $image->id
                ];
                continue;
            }

            $defaults = is_array($this->config["upload-defaults"]) ? $this->config["upload-defaults"] : [];

            $result = Uploader::upload($filesource, $defaults + [
                "use_filename" => true,
                "public_id" => $image->id,
                "tags" => $image->tags,
                "context" => $image->attributes
            ]);

            // On success a context object is present
            if(isset($result["context"])) {

                $image = new Image($result["public_id"], self::ID);

                $image->attributes = isset($result["context"]["custom"]) ? $result["context"]["custom"] : [];
                $image->tags = isset($result["tags"]) ? $result["tags"] : [];

                $image->info = [
                    Image::INFO_HEIGHT => $result["height"],
                    Image::INFO_WIDTH => $result["width"],
                    Image::INFO_SIZE => $result["bytes"],
                    Image::INFO_FORMAT => $result["format"],
                    Image::INFO_SOURCE => $result["url"],
                    Image::INFO_CREATED => $result["created_at"]
                ];

                $image->status = Image::STATUS_CLEAN;

            } elseif ($result["existing"]) {
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEEXISTS,
                    "id" => $image->id
                ];
                unset($images[$idx]);
            }

        }
        return $images;
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