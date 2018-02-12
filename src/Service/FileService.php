<?php
namespace Bolt\Extension\CND\ImageService\Service;
use Bolt;
use Silex\Application;
use Bolt\Extension\CND\ImageService\IConnector;
use Bolt\Extension\CND\ImageService\Image;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;

class FileService {

    /* @var array $files */
    protected $files = [];
    /* @var Bolt\Filesystem\Filesystem $cache */
    protected $storage = null;

    const TMP_MOUNT = "cache";
    const TMP_PREFIX = "/imgsrvc/";

    /**
     * Set up the object.
     *
     * @param Application $app
     */
    public function __construct(Application $app) {
        $this->container = $app;

        /* @var Bolt\Filesystem\Filesystem $filesystem */
        $this->storage = $app["filesystem"]->getFilesystem(self::TMP_MOUNT);
    }

    /**
     * @param string $id
     * @param string $filename
     * @param string $data
     */
    public function setFileContent($id, $filename, $data){
        $this->storage->write(self::TMP_PREFIX.$filename, $data);
        $this->files[$id] = $this->storage->get(self::TMP_PREFIX.$filename);
    }

    /**
     * @param string $id
     * @param string $filename
     * @param string $path
     */
    public function setFilePath($id, $filename, $path){

        if($this->storage->has(self::TMP_PREFIX.$filename))
            $this->storage->delete(self::TMP_PREFIX.$filename);

        $stream = fopen($path, "r");
        $this->storage->writeStream(self::TMP_PREFIX.$filename, $stream);
        fclose($stream);

        $this->files[$id] = $this->storage->get(self::TMP_PREFIX.$filename);
    }

    /**
     * @param $id
     * @param $filename
     * @param $url
     */
    public function setFileUrl($id, $filename, $url){
        if($this->storage->has(self::TMP_PREFIX.$filename))
            $this->storage->delete(self::TMP_PREFIX.$filename);

        $client = new \GuzzleHttp\Client();
        $response = $client->request('GET', $url);
        $this->storage->writeStream(self::TMP_PREFIX.$filename, $response->getBody());
        $this->files[$id] = $this->storage->get(self::TMP_PREFIX.$filename);
    }

    /**
     * @param Request $request
     */
    public function setFilesRequest($request = null){
        $request = $request ? $request : Request::createFromGlobals();

        /* @var UploadedFile $file */
        foreach($request->files->all() as $id => $file) {
            $this->setFilePath($id, $file->getClientOriginalName(), $file->getRealPath());
        }
    }

    /**
     * @param $id
     * @return Bolt\Filesystem\Handler\File|bool
     */
    public function getFile($id){
        return isset($this->files[$id]) ? $this->files[$id] : false;
    }

}