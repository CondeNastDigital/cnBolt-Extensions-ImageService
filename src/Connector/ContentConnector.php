<?php
namespace Bolt\Extension\CND\ImageService\Connector;

use Bolt\Application;
use Bolt\Filesystem\Handler\Image\Info;
use Bolt\Storage\Entity\Content;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Extension\CND\ImageService\IConnector;
use Bolt\Filesystem\Exception\IOException;
use Bolt\Storage\Entity\Taxonomy;
use Bolt\Storage\Repository;
use Sirius\Upload\Handler as UploadHandler;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;

class ContentConnector implements IConnector
{
    const ID = "content";
    const TITLE = "Content";
    const ICON = false;
    const LINK = false;
    
    /* @var Application $container */
    protected $container = null;
    
    /* @var array $config */
    protected $config = [];

    /* @var array $defaults */
    protected static $defaults = [
        "cache" => false,
        "contenttype" => "images",
        "delete" => true,
        "path" => "%year%/%month%",
        "tagtype" => "tags"
    ];
    
    /**
     * @inheritdoc
     */
    public function __construct(Application $app, $config){
        $this->config = $config + self::$defaults;
        $this->container = $app;
    }
    
    /**
     * @inheritdoc
     */
    public function imageUrl(Image $image, $width, $height, $mode, $format, $quality, $options) {
        $mode_map = [
            self::MODE_SCALE => "f",      # Bolt Fit (Bolt will not use "c" automatically if only one dimension is given)
            self::MODE_FILL => "c",       # Bolt Crop
            self::MODE_PAD => "b",        # Bolt Borders
            self::MODE_LIMIT => "r",      # Bolt Resize (Scaling up is controled for the "r" option in general in config.yml thumbnails/upscale)
            self::MODE_FIT => "r",        # Bolt Resize
        ];

        // Apply modifiers
        $modifiers = [];
        if($mode && isset($mode_map[$mode]))
            $modifiers["crop"] = $mode_map[$mode];
        if($width)
            $modifiers["width"] = (int)$width;
        if($height)
            $modifiers["height"] = (int)$height;

        if(is_array($options))
            $modifiers = $modifiers + $options;

        $this->updateImageData($image);

        return $this->container['url_generator']->generate(
            'thumb',
            [
                'width'  => $modifiers["width"],
                'height' => $modifiers["height"],
                'action' => $modifiers["crop"],
                'file'   => $image->info[Image::INFO_CUSTOM],
            ]
        );
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

        // Update status
        foreach($images as $idx => $image) {

            $content = $this->getContent($image);

            if($content instanceof Content){
                list($slug,$id) = explode("/",$image->id);

                /* @var Repository $repo */
                $repo = $this->container['storage']->getRepository($slug);

                if($this->config["delete"]) {
                    $file = $content->get("image");
                    if(isset($file["file"]) &&
                        $this->container["filesystem"]->has("files://".$file["file"]))
                        $this->container["filesystem"]->delete("files://".$file["file"]);

                    $repo->delete($content);
                } else {
                    $content->set("status", "held");
                    $repo->save($content);
                }

                unset($images[$idx]);
            }
            else {
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRUNKNOWN,
                    "id" => $image->id
                ];
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
     */
    protected function processUpdate(array $images, &$messages = []){
        
        foreach($images as $idx => $image){

            $content = $this->getContent($image);

            if($content instanceof Content){

                $content->setDatechanged(new \DateTime());
                $content->setValues($image->attributes);

                /* @var $taxonomies \Bolt\Storage\Collection\Taxonomy */
                $taxonomies = $this->container['storage']->createCollection('Bolt\Storage\Entity\Taxonomy');
                $taxonomies->setFromPost([
                    "taxonomy" => [
                        $this->config["tagtype"] => $image->tags
                    ]
                ], $content);
                $content->setTaxonomy($taxonomies);

                list($slug,$id) = explode("/",$image->id);

                /* @var Repository $repo */
                $repo = $this->container['storage']->getRepository($slug);
                $repo->update($content);

                $image->status = Image::STATUS_CLEAN;
            }
            else {
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRUNKNOWN,
                    "id" => $image->id
                ];
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
     */
    protected function processCreate(array $images, &$messages = []){
        
        $existing = [];

        $targetfolder = isset($this->config["path"]) ? $this->config["path"] : "%year%/%month%";
        $targetfolder = str_replace("%year%", date("Y"), $targetfolder);
        $targetfolder = str_replace("%month%", date("m"), $targetfolder);

        /* @var UploadedFile[] $files */
        $request = Request::createFromGlobals();
        $files = $request->files->all();

        foreach($images as $idx => &$image){
            // Check if a file was posted
            if(!isset($files[$image->id])){
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRNOFILE,
                    "id" => $image->id
                ];
                unset($images[$idx]);
                continue;
            }
            
            $filesource = $files[$image->id]->getPathName();
            $filename   = $files[$image->id]->getClientOriginalName();
            $size       = $files[$image->id]->getSize();
            $ext        = $files[$image->id]->getClientOriginalExtension();

            $parts = pathinfo($filename);
            $filename = $this->container["slugify"]->slugify($parts["filename"]).".".$ext;

            // Validation Config
            $allowedExtensions = $this->config['security']['allowed-extensions'];
            $allowedMaxSize    = $this->config['security']['max-size'];

            if(!$this->container['filepermissions']->allowedUpload($targetfolder."/".$filename)){
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ACCESSDENIED,
                    "id" => $image->id,
                    "file" => $targetfolder."/".$filename
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

            $job = [
                "name" => $filename,
                "tmp_name" => $filesource
            ];

            $finalfilename = $this->processUpload($targetfolder, $job);

            // On success a content object is created
            if($finalfilename) {

                $slug = $this->config["contentype"];

                /* @var Repository $repo */
                $repo = $this->container['storage']->getRepository($slug);
                /* @var Content $content */
                $content = $repo->create(['contenttype' => $slug, 'status' => 'published']);
                $content->setSlug($this->container["slugify"]->slugify($targetfolder."-".$filename));
                $content->setValues($image->attributes);
                $content->set("image", ["file" => $finalfilename]);

                /* @var $taxonomies \Bolt\Storage\Collection\Taxonomy */
                $taxonomies = $this->container['storage']->createCollection('Bolt\Storage\Entity\Taxonomy');
                $taxonomies->setFromPost([
                    "taxonomy" => [
                        $this->config["tagtype"] => $image->tags
                    ]
                ], $content);
                $content->setTaxonomy($taxonomies);

                $repo->save($content);

                $image->status = Image::STATUS_CLEAN;
                $image->id = $content->getContenttype()["slug"]."/".$content->getId();

                $this->updateImageData($image, true, $content);
            }
            else {
                $messages[] = [
                    "type" => IConnector::RESULT_TYPE_ERROR,
                    "code" => IConnector::RESULT_CODE_ERRFILEINVALID,
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
    public function imageSearch($search) {

        $slug = $this->config["contentype"];

        /* Currently, you can only search in contenttypes that are searchable and not viewless. Most of image types will not be!
        $contents = $this->container['query']->getContent($slug.'/search', ['filter' => $search]);
        */

        /* @var Repository $repo */
        $repo = $this->container['storage']->getRepository($slug);

        /* @var \Doctrine\DBAL\Query\QueryBuilder $qb */
        $qb = $this->container['db']->createQueryBuilder()
           ->select($repo->getAlias().".*")
           ->from($repo->getTableName(), $repo->getAlias())
           ->where("title LIKE :search")
           ->andWhere("status = 'published'")
           ->setParameter(":search", $search."%");

        $contents = $repo->findWith($qb);

        if(!$contents)
            $contents = [];

        $images = [];

        /* @var Content $content */
        foreach($contents as $content){

            $id = $content->getContenttype()["slug"]."/".$content->getId();
            $image = new Image($id, self::ID);

            $this->updateImageData($image, true, $content);

            $images[$id] = $image;
        }

        return $images;
    }
    
    /**
     * @inheritdoc
     */
    public function tagSearch($search){

        $table = $this->container["config"]->get('general/database/prefix');
        $table .= 'taxonomy';

        /* @var \Doctrine\DBAL\Query\QueryBuilder $qb */
        $qb = $this->container['db']->createQueryBuilder();

        $query = $qb->select("DISTINCT $table.name")
            ->from($table)
            ->where('taxonomytype = :taxonomytype')
            ->andWhere("name LIKE :search")
            ->orderBy('name', 'ASC')
            ->setParameters([
                ':taxonomytype' => $this->config["tagtype"],
                ':search' => $search.'%'
            ]);

        $results = $query->execute()->fetchAll();

        $tags = [];
        foreach($results as $result){
            $tags[] = $result["name"];
        }

        return $tags;
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
        return [];
    }

    // ---

    /**
     * @param Image $image
     * @param bool $purge
     * @param Content|boolean $content     ypu may provide the content object to use. If not, the correct one will be fetched automatically
     * @return void
     */
    protected function updateImageData(Image $image, $purge = false, $content = false){

        $info = $image->info + [Image::INFO_CUSTOM => false, Image::INFO_CACHED => false];

        // Check if we have a file already and it's cache has not run out
        if(!$purge && $info[Image::INFO_CUSTOM] && $info[Image::INFO_CACHED] + $this->config["cache"] > time())
           return;

        // Select Content for our image object
        if(!$content)
            $content = $this->getContent($image);
        if(!$content)
            return;

        // Since Bolt's refactoring of the Content object in 3.1+, there is no longer any clean solution to access a
        // content objects values (the old $content->getValues method)
        // https://github.com/bolt/bolt/issues/6579
        // FIXME: Refactor to a proper replacement as soon as it's available and remove $this->getValues() below
        $values = $this->getValues($content);

        // Fill in attributes
        $image->attributes = array_diff_key($values, array_flip(["slug","image","username"]));

        /* @var Taxonomy $taxonomy */
        $tags = [];
        foreach($content->getTaxonomy() as $taxonomy) {
            if($taxonomy->getTaxonomytype() == $this->config["tagtype"]){
                $tags[] = $taxonomy->getName();
            }
        }
        $image->tags = $tags;

        // Fill image info
        $imageField = $content->get("image");

        if(!isset($imageField))
            return;

        /* @var Info $info */
        $info = $this->container["filesystem"]->getImageInfo("files://".$imageField["file"]);
        $size = $this->container["filesystem"]->getSize("files://".$imageField["file"]);

        $image->info = [
            Image::INFO_HEIGHT => $info->getHeight(),
            Image::INFO_WIDTH => $info->getWidth(),
            Image::INFO_SIZE => $size,
            Image::INFO_FORMAT => strtolower($info->getType()->toString()),
            Image::INFO_SOURCE => $this->container['resources']->getUrl("files").$imageField["file"],
            Image::INFO_CREATED => date("c"),
            Image::INFO_CACHED => time(),
            Image::INFO_CUSTOM => $imageField["file"],
        ];

        return;
    }

    /**
     * @param Image $image
     * @return Content
     */
    protected function getContent(Image $image){
        // Select Content
        list($slug,$id) = explode("/",$image->id);
        /* @var Repository $repo */
        $repo = $this->container['storage']->getRepository($slug);
        /* @var Content $content */
        $content = $repo->findOneBy(["id" => $id]);

        return $content;
    }

    /**
     * Process an individual file upload.
     * Copied from \Bolt\Controller\Backend\FileManager::processUpload()
     *
     * @param string $path
     * @param array  $fileToProcess
     *
     * @return bool
     */
    protected function processUpload($path, $fileToProcess)
    {
        $this->container['upload.namespace'] = "files";

        /* @var UploadHandler $handler */
        $handler = $this->container['upload'];
        $handler->setPrefix($path . '/');
        try {
            $result = $handler->process($fileToProcess);
        } catch (IOException $e) {
            return false;
        }

        if (!$result->isValid()) {
            return false;
        }

        $name = $result->name;
        $result->confirm();

        return $name;
    }

    /**
     * FIXME: This function is a replacement for the broken Content::getValues() method and should be replaced asap
     * https://github.com/bolt/bolt/issues/6579
     * @param Content $content
     * @return array
     */
    protected function getValues(Content $content){
        $contenttype = $content->getContenttype();
        return array_intersect_key($content->_fields, $contenttype["fields"]);
    }
}