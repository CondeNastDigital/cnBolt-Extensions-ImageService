<?php
namespace Bolt\Extension\CND\ImageService\Controller;

use Bolt\Extension\CND\ImageService\Extension;
use Bolt\Extension\CND\ImageService\Image;
use Bolt\Extension\CND\ImageService\Service\ImageService;
use Silex\Application;
use Silex\ControllerCollection;
use Silex\ControllerProviderInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The controller
 */
class ImageController implements ControllerProviderInterface
{
    /** @var Application */
    protected $container;

    /**
     * {@inheritdoc}
     */
    public function connect(Application $app)
    {
        $this->container = $app;

        /** @var ControllerCollection $ctr */
        $ctr = $app['controllers_factory'];

        $ctr->get('/imagesearch', [$this, 'imageSearch']);
        $ctr->post('/imageprocess', [$this, 'imageProcess']);
        $ctr->get('/tagsearch', [$this, 'tagSearch']);
        $ctr->get('/imageurl', [$this, 'imageUrl']);

        return $ctr;
    }


    /**
     * Gets an image url
     * @param Request $request
     * @return JsonResponse
     */
    public function imageUrl(Request $request) {

        $imageId = $request->get('imageid');
        $width   = $request->get('width');
        $height  = $request->get('height');

        if(!$imageId)
            return new JsonResponse([
                "success" => false
            ]);

        $image = Image::create([
            'id' => $imageId
        ]);

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        $result = $service->imageUrl($image, $width, $height);

        return new JsonResponse([
            "url" => $result,
            "messages" => [],
            "success" => true
        ]);
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function imageProcess(Request $request)
    {
        $messages = [];
        $items = $request->get('items');
        $items = json_decode($items, true);

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        if(!is_array($items))
            return new JsonResponse([
                "success" => false
            ]);

        $images = [];
        foreach($items as $item)
            $images[] = Image::create($item);

        $images = $service->imageProcess($images, $messages);

        return new JsonResponse([
            "items" => $images,
            "messages" => $messages,
            "success" => true
        ]);

    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function imageSearch(Request $request)
    {
        $text = $request->get('q','');
        $text = strip_tags(urldecode($text));

        $images = [];

        if(trim($text)) {
            /* @var ImageService $service */
            $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

            $images = $service->imageSearch($text);
        }

        return new JsonResponse([
            "search" => $text,
            "items" => $images,
            "success" => true
        ]);
    }

    /**
     * @param Request $request
     * @param string $type
     * @return Response
     */
    public function tagSearch(Request $request)
    {
        $text = $request->get('q','');
        $text = strip_tags(urldecode($text));

        /* @var ImageService $service */
        $service = $this->container[Extension::APP_EXTENSION_KEY.".service"];

        $images = $service->tagSearch($text);

        return new JsonResponse([
            "search" => $text,
            "items" => $images,
            "success" => true
        ]);
    }
}