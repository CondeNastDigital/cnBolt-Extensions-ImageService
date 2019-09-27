<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Aws\CommandPool;
use Aws\Result;
use Aws\S3\S3Client;
use Bolt\Application;
use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Extension\CND\ImageService\IConnector;
use Bolt\Filesystem\Filesystem;
use Bolt\Filesystem\Handler\File;
use Exception;

class ShrimpConnector implements IConnector
{
    const ID = "shrimp";
    const TITLE = "Shrimp";
    const ICON = "https://s16896.pcdn.co/wp-content/uploads/cropped-CN_favicon_512px.jpg";
    const LINK = "http://www.condenast.de";

    protected static $FORBIDDEN_TARGETFOLDERS = ['thumbs'];

    /* @var Application $container */
    protected $container = null;
    /* @var array $config */
    protected $config = [];
    /* @var S3Client $client */
    protected $client;

    /**
     * @inheritdoc
     */
    public function __construct(Application $app, $config){
        $this->config = $config;
        $this->container = $app;
    }

    /**
     * @inheritdoc
     * @throws Exception
     */
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options) {

        $mode_map = [
            self::MODE_SCALE => "scale",
            self::MODE_FILL => "fill",
            self::MODE_PAD => "pad",
            self::MODE_LIMIT => "limit",
            self::MODE_FIT => "fit",
        ];

        if($width && !is_numeric($width) && !$height){
            // Alias - directly use alias as string
            $parameters = preg_replace('/[A-za-z0-9\-\_]/','',$width);
        } else {
            // Non-Alias - Apply modifiers
            $parameters = [];
            if($mode && isset($mode_map[$mode]))
                $parameters[] = "c_".$mode_map[$mode];
            if($width)
                $parameters[] = "w_".$width;
            if($height)
                $parameters[] = "h_".$height;
            if($quality)
                $parameters[] = "q_".$quality;

            if(is_array($options))
                $parameters += $options;

            $parameters = implode(',',$parameters);
        }

        $endpoint = $this->config["endpoint"] ?? false;
        $key = $this->config["key"] ?? false;
        if(!$endpoint || !$key)
            throw new Exception("Shrimp connector is not configured correctly");

        $pathinfo = pathinfo($image);
        $folder = trim($pathinfo['dirname'],'/');
        $slug = $pathinfo['filename'];

        $imagepath = $parameters.'/'.(!in_array($folder, ['','.']) ? $folder.'/' : '').$slug.'.'.$format;
        $signature  = $this->sign($imagepath);

        return $endpoint.'/'.$signature.'/'.$imagepath;
    }

    /**
     * @inheritdoc
     */
    public function imageProcess(array $images, &$messages = []) {
        $create = [];
        $update = [];
        $delete = [];
        $clean = [];

        foreach($images as $key => $image){
            //$images[$key] = $this->imageToCloudinary($image);
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
     * @throws Exception
     */
    protected function processDelete(array $images, &$messages = []){

        $this->connect();

        // Collect ids
        $objects = [];
        foreach($images as $image)
            $objects[] = ['Key' => $image->id];

        // Process deletion request
        $result = $this->client->deleteObjects([
            'Bucket' => $this->config['bucket'],
            'Delete' => [
                'Objects' => $objects
            ]
        ])->toArray();

        // Process results
        $deleted = [];
        foreach($result['Deleted'] ?? [] as $object){
            $deleted[] = $object['Key'];
        }
        foreach($result['Errors'] ?? [] as $object){
            $messages[] = [
                "type" => IConnector::RESULT_TYPE_ERROR,
                "code" => IConnector::RESULT_CODE_ERRUNKNOWN,
                "id" => $object['Key']
            ];
        }

        // Update status
        foreach($images as $idx => $image) {
            if (in_array($image->id, $deleted, true)) {
                unset($images[$idx]);
            }
        }

        return $images;
    }

    /**
     * Delete all ids in array
     * NOTE: Cloudinary
     * @param Image[] $images
     * @param array $messages
     * @return \Bolt\Extension\CND\ImageService\Image[]
     * @throws Exception
     */
    protected function processUpdate(array $images, &$messages = []){
        $this->connect();

        $bucket = $this->config['bucket'];

        foreach($images as $idx => $image){

            $meta = $this->image2s3object($image);
            // try {
                $result = $this->client->copyObject([
                    'Bucket' => $bucket,
                    'CopySource' => $bucket . '/' . urlencode($image->id),
                    'Key' => $image->id,
                    'Metadata' => $meta,
                    'ACL' => 'public-read',
                    'MetadataDirective' => 'REPLACE',
                ]);

                $image->status = Image::STATUS_CLEAN;
            // } catch (Exception $e){}
        }

        return $images;
    }

    /**
     * Delete all ids in array
     * NOTE: Cloudinary
     * @param Image[] $images
     * @param array $messages
     * @return \Bolt\Extension\CND\ImageService\Image[]
     * @throws Exception
     */
    protected function processCreate(array $images, &$messages = []){
        $this->connect();

        $bucket = $this->config['bucket'];

        $targetfolder = isset($this->config["path"]) ? $this->config["path"] : "%year%/%month%";
        $targetfolder = str_replace(['%year%', '%month%'], [date('Y'),  date('m')], $targetfolder);
        if(in_array($targetfolder, $this::$FORBIDDEN_TARGETFOLDERS, true)){
            throw new Exception('Invalid target folder "'.$targetfolder.'" specified');
        }

        $FileService = $this->container[Extension::APP_EXTENSION_KEY.".file"];

        foreach($images as $idx => &$image){
            // Check if a file was posted
            /* @var File $file */
            $file = $FileService->getFile($image->id);
            if(!$file){
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRNOFILE,
                    "id" => $image->id
                ];
                unset($images[$idx]);
                continue;
            }

            $size       = $file->getSize();
            $ext        = $file->getExtension();
            $filename   = $file->getFilename($ext);

            // Validation Config
            $allowedExtensions = $this->config['security']['allowed-extensions'];
            $allowedMaxSize    = $this->config['security']['max-size'];

            // Simple Validation of the uploaded images
            if(!$file->exists()) {               // file doesnt exist or permissions wrong
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

            if(!in_array($ext, $allowedExtensions, true) ||        // extension is not allowed
                !in_array($ext, self::supportedFormats(), true)) {  // extension is not supported
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEEXT,
                    "id" => $image->id
                ];
                unset($images[$idx]);
                continue;
            }

            $defaults = $this->config["upload-defaults"] ?? [];

            /* @var Filesystem $filemount */
            $filemount = $this->container["filesystem"]->getFilesystem($file->getMountPoint());
            $filesource = $filemount->getAdapter()->getPathPrefix().$file->getPath();

            // Create a good filename  /Key for S3
            $image->id = $this->container['slugify']->slugify($filename).'-'.$ext.'-'.uniqid('',false);

            if($targetfolder){
                $image->id = $targetfolder.'/'.$image->id;
            }

            $meta = $this->image2s3object($image, $filesource);

            // Put to s3
            $result = $this->client->putObject([
                'Bucket' => $this->config["bucket"],
                'Key' => $image->id,
                'SourceFile' => $filesource,
                'Metadata' => $meta,
                'ContentType' => $meta['shrimp-info-'.Image::INFO_FORMAT],
                'ACL' => 'public-read'
            ])->toArray();

            if(isset($result['ObjectURL'])) {
                $info = $image->info;
                $info[Image::INFO_SOURCE] = $result['ObjectURL'];
                $image->info = $info;
                $image->status = Image::STATUS_CLEAN;
            } else {
                $this->container["logger"]->warn("Error while uploading file to storage in S3", ["result" => $result, "source" => $filesource, "target" => $image->id]);
            }
        }

        return $images;
    }

    /**
     * @inheritdoc
     * @throws Exception
     */
    public function imageSearch($search) {

        $this->connect();

        $bucket = $this->config['bucket'];

        // Get matching object id's
        $results = $this->client->listObjects([
            'Bucket' => $bucket,
            'MaxKeys' => 25,
            'Prefix' => $search,
        ]);
        $results = $results->toArray()['Contents'] ?? [];
        if(!$results)
            return [];

        // Batch request all head's for found object ids
        $commands = [];
        foreach ($results as $result) {
            $commands[] = $this->client->getCommand('HeadObject', array(
                'Bucket' => $bucket,
                'Key'    => $result['Key']
            ));
        }

        $images = [];
        $results = CommandPool::batch($this->client, $commands);
        foreach($results as $result){
            /* @var Result $result */
            $result = $result->toArray();
            $image = $this->s3object2image($result);
            if($image)
                $images[] = $image;
        }
        return $images;
    }

    /**
     * @inheritdoc
     * NOTE: Not supported by s3 yet
     * FIXME: Might change when we implement image recognition and auto tags?
     */
    public function tagSearch($search){
        return [];
    }

    /**
     * Converts the results of a HeadObject request to S3 back into an image object
     * @param $object
     * @return Image|false
     */
    protected function s3object2image($object) {
        $meta = $object['Metadata'] ?? [];
        $id = $meta['shrimp-id'] ?? false;
        if(!$id)
            return false;

        $image = new Image($id, self::ID);
        $info = [];
        $attributes = [];

        foreach($meta as $key => $value){
            preg_match('/^shrimp-([a-z0-9]+)-(.*)$/', $key, $matches);
            switch($matches[1] ?? false){
                case 'attr':
                    $attributes[$matches[2]] = self::decodeValue($value);
                    break;
                case 'info':
                    $info[$matches[2]] = $value;
                    break;
            }
        }

        $info += [
            Image::INFO_HEIGHT => 0,  // FIXME: restore from meta
            Image::INFO_WIDTH => 0,  // FIXME: restore from meta
            Image::INFO_SIZE => $object['ContentLength'],
            Image::INFO_FORMAT => $object['ContentType'], // FIXME: map
            Image::INFO_CREATED => $object['LastModified']->format("c"),
        ];
        $info[Image::INFO_SOURCE] = $object['@metadata']['effectiveUri'];

        $image->tags = [];
        $image->info = $info;
        $image->attributes = $attributes;

        return $image;
    }

    /**
     * Convert an image into a meta array to be put into a PutObject's nmeta property.
     * If a filepath is given, info fields will also be updated
     * @param Image $image
     * @param string|bool $filepath
     * @return array
     */
    protected function image2s3object(Image $image, $filepath = false){
        $meta = [
            'shrimp-id' => $image->id,
        ];

        // Recalculate Image Info if available
        if($filepath && file_exists($filepath)){
            $imageinfo = getimagesize($filepath);
            $info = $image->info;
            $info = [
                Image::INFO_WIDTH   => $imageinfo[0],
                Image::INFO_HEIGHT  => $imageinfo[1],
                Image::INFO_CREATED => date('c'),
                Image::INFO_FORMAT  => $imageinfo['mime'],
                Image::INFO_SIZE    => filesize($filepath),
            ] + $info;
            $image->info = $info;
        }

        // Attributes
        foreach($image->attributes as $key => $value){
            $meta['shrimp-attr-'.$key] = self::encodeValue($value);
        }

        // Infos
        foreach($image->info as $key => $value){
            $meta['shrimp-info-'.$key] = $value;
        }

        // Cleanup characters dangerous for S3
        foreach($meta as $key => $value) {
            $value = trim($value);
            $value = str_replace(['\n','\r','\t'], ' ', $value);
            $meta[$key] = $value;
        }

        return $meta;
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
    public function supportedFormats() {
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
    public function adminImage($imageKey) {
        // TODO: Implement adminImage() method.
    }

    /**
     * @inheritdoc
     */
    public function adminGlobal() {
        // AWS S3 has no ui for normal users
        return [];
    }

    /**
     * @param string $string
     * @return string
     * @throws Exception
     */
    protected function sign($string){
        $key = $this->config["key"] ?? false;
        if(!$key)
            throw new Exception("Key for shrimp service missing");

        $signature = substr(hash_hmac("sha256", $string, $key, true),0,10);
        $signature = trim(base64_encode($signature),"=");
        $signature = str_replace(['/','+'],['-','_'],$signature);

        return $signature;
    }

    /**
     * @throws Exception
     */
    protected function connect(){
        if($this->client)
            return;

        if(!class_exists('Aws\Resource\Aws'))
            throw new Exception("AWS SDK is not installed");

        $config = $this->config['AWS'] ?? false;
        if(!$config)
            throw new Exception("AWS S3 config missing");

        $bucket = $this->config['bucket'] ?? false;
        if(!$bucket)
            throw new Exception("AWS S3 bucket name missing");

        $config = [
            'version' => '2006-03-01'
        ] + $config;

        $this->client = new S3Client($config);
    }

    protected static function encodeValue($input){
        return urlencode($input);
    }

    protected static function decodeValue($input){
        return urldecode($input);
    }


}