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
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options) {
        $mode_map = [
            self::MODE_SCALE => "scale",
            self::MODE_FILL => "fill",
            self::MODE_PAD => "pad",
            self::MODE_LIMIT => "limit",
            self::MODE_FIT => "fit",
        ];
        
        // Apply modifiers
        $modifiers = [];
        if($mode && isset($mode_map[$mode]))
            $modifiers["crop"] = $mode_map[$mode];
        if($width)
            $modifiers["width"] = (int)$width;
        if($height)
            $modifiers["height"] = (int)$height;
        if(in_array($format, $this->supportedFormats()))
            $modifiers["format"] = $format;
        if($quality)
            $modifiers["quality"] = (int)$quality;
        
        if(is_array($options))
            $modifiers = $modifiers + $options;
        
        return Cloudinary::cloudinary_url($image->id, $modifiers);
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
            $images[$key] = $this->prepareImage($image);
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
        
        $existing = [];
        
        foreach($images as $idx => &$image){
            // Check if a file was posted
            if(!isset($_FILES[$image->id])){
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRNOFILE,
                    "id" => $image->id
                ];
                unset($images[$idx]);
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
                unset($images[$idx]);
                continue;
            }
            
            if($size > $allowedMaxSize){                    // file size is to large
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILESIZE,
                    "id" => $image->id
                ];
                unset($images[$idx]);
                continue;
            }
            
            if(!in_array(strtolower($ext), $allowedExtensions) ||        // extension is not allowed
                !in_array(strtolower($ext), self::supportedFormats())) {  // extension is not supported
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEEXT,
                    "id" => $image->id
                ];
                unset($images[$idx]);
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
            if(isset($result["public_id"])) {
                
                $image = $this->cloudinaryToImage($result);
                $image->status = Image::STATUS_CLEAN;
                
            }
            
            if ($result["existing"]) {
                
                $api = new Api();
                $existing = $api->resource($result["public_id"]);
                $image = $this->cloudinaryToImage($existing);
                
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_WARN,
                    "code" => IConnector::RESULT_CODE_ERRFILEEXISTS,
                    "id" => $image->id
                ];
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
        $resultTag = $api->resources_by_tag(
            urlencode($search),
            [
                "type" => "upload",
                "resource_type" => "image",
                "max_results" => 10,
                "tags" => true,
                "context" => true
            ]
        );
        
        // Merge both search results into one
        $results = array_merge($resultId["resources"], $resultTag["resources"]);
        
        // Convert cloudinary resource items to image items
        $images = [];
        foreach($results as $item){
            $image = $this->cloudinaryToImage($item);
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
     * Converts cloudinary format to Imageservice Image object
     * @param $coudinary
     * @return Image
     */
    private function prepareImage(Image $image) {
        
        $attributes = $image->attributes;
        foreach($attributes as &$attribute){
            $attribute = htmlentities($attribute, ENT_COMPAT | ENT_HTML401 , ini_get("default_charset"), false );
        }
        $image->attributes = $attributes;
        
        return $image;
    }
    
    /**
     * Converts cloudinary format to Imageservice Image object
     * @param $coudinary
     * @return Image
     */
    private function cloudinaryToImage($coudinary) {
        
        $image = new Image($coudinary["public_id"], self::ID);
        
        $image->attributes = isset($coudinary["context"]["custom"]) ? $coudinary["context"]["custom"] : [];
        $image->tags = isset($coudinary["tags"]) ? $coudinary["tags"] : [];
        
        $image->info = [
            Image::INFO_HEIGHT => $coudinary["height"],
            Image::INFO_WIDTH => $coudinary["width"],
            Image::INFO_SIZE => $coudinary["bytes"],
            Image::INFO_FORMAT => $coudinary["format"],
            Image::INFO_SOURCE => $coudinary["url"],
            Image::INFO_CREATED => $coudinary["created_at"]
        ];
        
        return $image;
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
            self::FORMAT_JPEG,
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